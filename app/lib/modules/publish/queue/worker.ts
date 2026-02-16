import { jobReporter, JobStatus, ProgressCode } from '../status/reporter';
import {
  JobDefinition,
  JobType,
  JobResult,
  shouldRetryJob,
  calculateRetryDelay,
  createJobResult,
  createJobErrorResult,
  type SubmitIOSJobData,
  type SubmitAndroidJobData,
  type ValidateMetadataJobData,
  type NormalizeAssetsJobData,
  type PreflightCheckJobData,
} from './jobs';
import { logger, LogLevel } from '../util/logging';
import { runPreflightValidations } from '../metadata/validator';
import { normalizeAssets, getAssetValidationReport } from '../assets/normalizer';
import { getAppStoreConnectClient, getPlayDeveloperClient } from '../adapters/index';

/**
 * In-memory job queue and worker
 * In production, replace with BullMQ or Redis-backed queue
 */

class JobQueue {
  private queue: JobDefinition[] = [];
  private processing: boolean = false;
  private jobCounters: Map<JobType, number> = new Map();

  /**
   * Add job to queue
   */
  enqueue(job: JobDefinition): void {
    this.queue.push(job);
    this.queue.sort((a, b) => b.priority - a.priority); // Sort by priority (higher first)
    logger.debug(`Job ${job.id} enqueued`, { type: job.type, priority: job.priority });
  }

  /**
   * Get next job to process
   */
  dequeue(): JobDefinition | undefined {
    return this.queue.shift();
  }

  /**
   * Get queue length
   */
  length(): number {
    return this.queue.length;
  }

  /**
   * Get jobs by status
   */
  getJobsByType(type: JobType): JobDefinition[] {
    return this.queue.filter((j) => j.type === type);
  }

  /**
   * Get job type counter
   */
  getJobCounter(type: JobType): number {
    return this.jobCounters.get(type) || 0;
  }

  /**
   * Increment job type counter
   */
  incrementJobCounter(type: JobType): void {
    const current = this.getJobCounter(type);
    this.jobCounters.set(type, current + 1);
  }
}

/**
 * Job worker
 */
export class JobWorker {
  private queue: JobQueue;
  private activeJobs: Map<string, AbortController> = new Map();
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.queue = new JobQueue();
  }

  /**
   * Start worker
   */
  start(intervalMs: number = 1000): void {
    if (this.processing) {
      logger.warn('Worker already started');
      return;
    }

    this.processing = true;
    logger.info('Job worker started');

    this.intervalId = setInterval(() => {
      this.processNextJob();
    }, intervalMs);
  }

  /**
   * Stop worker
   */
  stop(): void {
    this.processing = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Cancel all active jobs
    this.activeJobs.forEach((controller, jobId) => {
      controller.abort();
      jobReporter.cancelJob(jobId);
    });
    this.activeJobs.clear();

    logger.info('Job worker stopped');
  }

  /**
   * Submit job to queue
   */
  submitJob(job: JobDefinition): string {
    this.queue.enqueue(job);
    jobReporter.createJob(job.id, job.platform as any, job.dryRun);
    return job.id;
  }

  /**
   * Cancel job
   */
  cancelJob(jobId: string): void {
    const controller = this.activeJobs.get(jobId);
    if (controller) {
      controller.abort();
      this.activeJobs.delete(jobId);
    }

    // Also remove from queue if not started yet
    const index = this.queue.length() > 0 ? this.queue['queue'].findIndex((j) => j.id === jobId) : -1;
    if (index >= 0) {
      this.queue['queue'].splice(index, 1);
    }

    jobReporter.cancelJob(jobId);
  }

  /**
   * Process next job in queue
   */
  private async processNextJob(): Promise<void> {
    if (!this.processing) {
      return;
    }

    const job = this.queue.dequeue();
    if (!job) {
      return;
    }

    const abortController = new AbortController();
    this.activeJobs.set(job.id, abortController);

    try {
      await this.processJob(job, abortController.signal);
    } catch (error: any) {
      logger.error(`Job ${job.id} processing error`, { error: error.message });

      if (shouldRetryJob(job)) {
        job.retryCount++;
        const delay = calculateRetryDelay(job.retryCount);
        logger.info(`Retrying job ${job.id} (attempt ${job.retryCount}) after ${delay}ms`);

        setTimeout(() => {
          job.status = JobStatus.QUEUED;
          this.queue.enqueue(job);
        }, delay);
      } else {
        job.status = JobStatus.FAILED;
        jobReporter.setJobResult(job.id, {
          success: false,
          errors: [error.message],
          warnings: [],
        });
      }
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * Process single job
   */
  private async processJob(job: JobDefinition, signal: AbortSignal): Promise<void> {
    if (signal.aborted) {
      job.status = JobStatus.CANCELLED;
      return;
    }

    job.status = JobStatus.RUNNING;
    job.startedAt = new Date().toISOString();
    jobReporter.updateJobStatus(job.id, JobStatus.RUNNING);

    const startTime = Date.now();
    let result: JobResult;

    try {
      switch (job.type) {
        case JobType.IOS_SUBMIT_TESTFLIGHT_INTERNAL:
        case JobType.IOS_SUBMIT_TESTFLIGHT_EXTERNAL:
        case JobType.IOS_SUBMIT_APP_STORE:
          result = await this.processIOSSubmit(job.data as SubmitIOSJobData, job.id, signal);
          break;

        case JobType.ANDROID_SUBMIT_INTERNAL:
        case JobType.ANDROID_SUBMIT_ALPHA:
        case JobType.ANDROID_SUBMIT_BETA:
        case JobType.ANDROID_SUBMIT_PRODUCTION:
          result = await this.processAndroidSubmit(job.data as SubmitAndroidJobData, job.id, signal);
          break;

        case JobType.VALIDATE_METADATA:
          result = await this.processValidateMetadata(job.data as ValidateMetadataJobData, job.id, signal);
          break;

        case JobType.NORMALIZE_ASSETS:
          result = await this.processNormalizeAssets(job.data as NormalizeAssetsJobData, job.id, signal);
          break;

        case JobType.PREFLIGHT_CHECK:
          result = await this.processPreflightCheck(job.data as PreflightCheckJobData, job.id, signal);
          break;

        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }
    } catch (error: any) {
      if (signal.aborted) {
        job.status = JobStatus.CANCELLED;
        return;
      }

      result = createJobErrorResult(error.message);
    }

    const duration = Date.now() - startTime;

    if (result.success) {
      job.status = JobStatus.SUCCEEDED;
      job.completedAt = new Date().toISOString();
      job.result = result.data;
      jobReporter.setJobResult(job.id, {
        success: true,
        url: result.data as any,
        errors: [],
        warnings: result.warnings,
      });
    } else {
      job.status = JobStatus.FAILED;
      job.completedAt = new Date().toISOString();
      job.error = result.error;
      jobReporter.setJobResult(job.id, {
        success: false,
        errors: result.error ? [result.error] : [],
        warnings: result.warnings,
      });
    }

    this.queue.incrementJobCounter(job.type);
  }

  /**
   * Process iOS submission
   */
  private async processIOSSubmit(
    data: SubmitIOSJobData,
    jobId: string,
    signal: AbortSignal,
  ): Promise<JobResult> {
    jobReporter.addProgress(jobId, ProgressCode.IOS_VALIDATION_START, 'Validating iOS metadata', 10);

    const ascClient = getAppStoreConnectClient();
    await ascClient.validateSubmission(data);

    jobReporter.addProgress(jobId, ProgressCode.IOS_VALIDATION_COMPLETE, 'iOS metadata validated', 20);

    if (data.buildPath && !data.skipMetadata) {
      jobReporter.addProgress(jobId, ProgressCode.IOS_UPLOAD_START, 'Uploading iOS build', 30);
      const uploadResult = await ascClient.uploadBuild(data);
      jobReporter.addProgress(jobId, ProgressCode.IOS_UPLOAD_COMPLETE, 'Build uploaded successfully', 60);
      jobReporter.addProgress(jobId, ProgressCode.IOS_BUILD_PROCESSING, 'Waiting for build processing', 70);

      // Poll for build processing
      await ascClient.waitForBuildProcessing(uploadResult.buildId, signal);
      jobReporter.addProgress(jobId, ProgressCode.IOS_BUILD_PROCESSED, 'Build processing complete', 80);
    }

    jobReporter.addProgress(jobId, ProgressCode.IOS_VERSION_SUBMITTED, 'Version submitted for review', 90);

    if (data.releaseType === 'testflight-internal' || data.releaseType === 'testflight-external') {
      jobReporter.addProgress(jobId, ProgressCode.IOS_REVIEW_PENDING, 'TestFlight review pending', 95);
    } else {
      jobReporter.addProgress(jobId, ProgressCode.IOS_REVIEW_PENDING, 'App Store review pending', 95);
    }

    return createJobResult({
      bundleId: data.bundleId,
      version: data.version,
      buildNumber: data.buildNumber,
      url: `https://appstoreconnect.apple.com/apps`,
    });
  }

  /**
   * Process Android submission
   */
  private async processAndroidSubmit(
    data: SubmitAndroidJobData,
    jobId: string,
    signal: AbortSignal,
  ): Promise<JobResult> {
    jobReporter.addProgress(jobId, ProgressCode.ANDROID_VALIDATION_START, 'Validating Android metadata', 10);

    const playClient = getPlayDeveloperClient();
    await playClient.validateSubmission(data);

    jobReporter.addProgress(jobId, ProgressCode.ANDROID_VALIDATION_COMPLETE, 'Android metadata validated', 20);

    if (data.buildPath && !data.skipMetadata) {
      jobReporter.addProgress(jobId, ProgressCode.ANDROID_UPLOAD_START, 'Uploading Android build', 30);
      const uploadResult = await playClient.uploadBuild(data);
      jobReporter.addProgress(jobId, ProgressCode.ANDROID_UPLOAD_COMPLETE, 'Build uploaded successfully', 60);

      jobReporter.addProgress(jobId, ProgressCode.ANDROID_EDIT_CREATED, 'Creating Play Store edit', 65);
      const editId = await playClient.createEdit(data.packageName);

      jobReporter.addProgress(jobId, ProgressCode.ANDROID_TRACK_ASSIGNED, 'Assigning to track', 75);
      await playClient.assignToTrack(editId, data.track, data.versionCode);

      jobReporter.addProgress(jobId, ProgressCode.ANDROID_RELEASE_NOTES_ADDED, 'Adding release notes', 80);
      await playClient.addReleaseNotes(editId, data.track, data.versionCode, data.metadata?.android.changelogs || {});

      jobReporter.addProgress(jobId, ProgressCode.ANDROID_EDIT_COMMITTED, 'Committing edit', 85);
      await playClient.commitEdit(editId);

      if (data.track === 'production' && data.userFraction && data.userFraction > 0) {
        jobReporter.addProgress(jobId, ProgressCode.ANDROID_ROLLOUT_STARTED, 'Starting staged rollout', 90);
      }
    }

    return createJobResult({
      packageName: data.packageName,
      versionCode: data.versionCode,
      url: `https://play.google.com/console/developers`,
    });
  }

  /**
   * Process metadata validation
   */
  private async processValidateMetadata(
    data: ValidateMetadataJobData,
    jobId: string,
    _signal: AbortSignal,
  ): Promise<JobResult> {
    const result = await runPreflightValidations(data.metadata, data.dryRun);

    if (!result.valid) {
      const errors = [
        ...result.results.schema.errors.map((e) => `${e.field}: ${e.message}`),
        ...result.results.completeness.errors.map((e) => `${e.field}: ${e.message}`),
        ...result.results.iosVersion.errors.map((e) => `${e.field}: ${e.message}`),
        ...result.results.androidVersion.errors.map((e) => `${e.field}: ${e.message}`),
      ];

      return createJobErrorResult('Metadata validation failed', errors);
    }

    return createJobResult({ valid: true }, [
      ...result.results.schema.warnings.map((w) => w.message),
      ...result.results.completeness.warnings.map((w) => w.message),
    ]);
  }

  /**
   * Process asset normalization
   */
  private async processNormalizeAssets(
    data: NormalizeAssetsJobData,
    jobId: string,
    _signal: AbortSignal,
  ): Promise<JobResult> {
    const result = await normalizeAssets(data.platform, data.assets, data.outputDir);

    if (!result.success) {
      return createJobErrorResult('Asset normalization failed', result.errors);
    }

    return createJobResult({ normalized: true });
  }

  /**
   * Process preflight check
   */
  private async processPreflightCheck(
    data: PreflightCheckJobData,
    jobId: string,
    _signal: AbortSignal,
  ): Promise<JobResult> {
    const result = await runPreflightValidations(data.metadata, data.dryRun);

    if (!result.valid) {
      const errors = [
        ...result.results.schema.errors.map((e) => `${e.field}: ${e.message}`),
        ...result.results.completeness.errors.map((e) => `${e.field}: ${e.message}`),
      ];

      return createJobErrorResult('Preflight check failed', errors);
    }

    return createJobResult({ valid: true });
  }

  /**
   * Get queue statistics
   */
  getStatistics() {
    return {
      queueLength: this.queue.length(),
      activeJobs: this.activeJobs.size,
      processing: this.processing,
    };
  }
}

// Singleton worker instance
export const worker = new JobWorker();
