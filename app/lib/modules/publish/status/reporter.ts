import { logger, LogEntry, ProgressCode } from '../util/logging';
import { type StoreMetadata } from '../metadata';

/**
 * Job status tracking and reporting
 */

export enum JobStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  WAITING = 'WAITING', // Waiting for external processing (e.g., build processing)
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum Platform {
  IOS = 'ios',
  ANDROID = 'android',
  BOTH = 'both',
}

export interface JobProgress {
  code: ProgressCode;
  message: string;
  timestamp: string;
  percentage?: number;
  data?: Record<string, unknown>;
}

export interface PublishJob {
  id: string;
  platform: Platform;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  dryRun: boolean;
  metadata?: StoreMetadata;
  logs: LogEntry[];
  progress: JobProgress[];
  result?: {
    success: boolean;
    url?: string;
    version?: string;
    errors: string[];
    warnings: string[];
  };
}

/**
 * Job status reporter class
 */
export class JobStatusReporter {
  private jobs: Map<string, PublishJob> = new Map();

  /**
   * Create a new job
   */
  createJob(
    id: string,
    platform: Platform,
    dryRun: boolean = false,
    metadata?: StoreMetadata,
  ): PublishJob {
    const job: PublishJob = {
      id,
      platform,
      status: JobStatus.QUEUED,
      createdAt: new Date().toISOString(),
      dryRun,
      metadata,
      logs: [],
      progress: [],
    };

    this.jobs.set(id, job);
    this.addProgress(id, ProgressCode.JOB_STARTED, `Job ${id} created and queued`);
    logger.info(`Job ${id} created`, { platform, dryRun }, ProgressCode.JOB_STARTED);

    return job;
  }

  /**
   * Get job by ID
   */
  getJob(id: string): PublishJob | undefined {
    return this.jobs.get(id);
  }

  /**
   * Update job status
   */
  updateJobStatus(id: string, status: JobStatus): void {
    const job = this.jobs.get(id);
    if (!job) {
      return;
    }

    job.status = status;

    if (status === JobStatus.RUNNING && !job.startedAt) {
      job.startedAt = new Date().toISOString();
    }

    if (status === JobStatus.SUCCEEDED || status === JobStatus.FAILED || status === JobStatus.CANCELLED) {
      job.completedAt = new Date().toISOString();
    }

    logger.debug(`Job ${id} status updated to ${status}`);
  }

  /**
   * Add progress event
   */
  addProgress(id: string, code: ProgressCode, message: string, percentage?: number, data?: Record<string, unknown>): void {
    const job = this.jobs.get(id);
    if (!job) {
      return;
    }

    const progress: JobProgress = {
      code,
      message,
      timestamp: new Date().toISOString(),
      percentage,
      data,
    };

    job.progress.push(progress);
    logger.info(message, data, code);
  }

  /**
   * Add log entry to job
   */
  addLog(id: string, log: LogEntry): void {
    const job = this.jobs.get(id);
    if (!job) {
      return;
    }

    job.logs.push(log);
  }

  /**
   * Set job result
   */
  setJobResult(
    id: string,
    result: {
      success: boolean;
      url?: string;
      version?: string;
      errors: string[];
      warnings: string[];
    },
  ): void {
    const job = this.jobs.get(id);
    if (!job) {
      return;
    }

    job.result = result;

    if (result.success) {
      this.updateJobStatus(id, JobStatus.SUCCEEDED);
      this.addProgress(id, ProgressCode.JOB_COMPLETED, 'Job completed successfully', 100, {
        url: result.url,
        version: result.version,
      });
    } else {
      this.updateJobStatus(id, JobStatus.FAILED);
      this.addProgress(id, ProgressCode.JOB_FAILED, 'Job failed', undefined, {
        errors: result.errors,
      });
    }
  }

  /**
   * Cancel job
   */
  cancelJob(id: string): void {
    const job = this.jobs.get(id);
    if (!job) {
      return;
    }

    if (job.status === JobStatus.RUNNING || job.status === JobStatus.WAITING || job.status === JobStatus.QUEUED) {
      this.updateJobStatus(id, JobStatus.CANCELLED);
      this.addProgress(id, ProgressCode.JOB_CANCELLED, 'Job was cancelled');
      logger.info(`Job ${id} cancelled`);
    }
  }

  /**
   * Get job progress percentage
   */
  getProgressPercentage(id: string): number {
    const job = this.jobs.get(id);
    if (!job || job.progress.length === 0) {
      return 0;
    }

    const latestProgress = job.progress[job.progress.length - 1];
    return latestProgress.percentage || 0;
  }

  /**
   * Get job logs
   */
  getJobLogs(id: string): LogEntry[] {
    const job = this.jobs.get(id);
    return job?.logs || [];
  }

  /**
   * Get job progress history
   */
  getJobProgress(id: string): JobProgress[] {
    const job = this.jobs.get(id);
    return job?.progress || [];
  }

  /**
   * List all jobs
   */
  listJobs(): PublishJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * List jobs by status
   */
  listJobsByStatus(status: JobStatus): PublishJob[] {
    return this.listJobs().filter((job) => job.status === status);
  }

  /**
   * Clean up old jobs (keep last N)
   */
  cleanupOldJobs(keepCount: number = 100): void {
    const jobs = this.listJobs();

    if (jobs.length <= keepCount) {
      return;
    }

    const toDelete = jobs.slice(keepCount);
    toDelete.forEach((job) => {
      this.jobs.delete(job.id);
    });

    logger.info(`Cleaned up ${toDelete.length} old jobs`);
  }

  /**
   * Export job logs as text
   */
  exportJobLogs(id: string): string {
    const job = this.jobs.get(id);
    if (!job) {
      return '';
    }

    const header = [
      `Job ID: ${job.id}`,
      `Platform: ${job.platform}`,
      `Status: ${job.status}`,
      `Created: ${job.createdAt}`,
      job.startedAt ? `Started: ${job.startedAt}` : '',
      job.completedAt ? `Completed: ${job.completedAt}` : '',
      job.dryRun ? 'Mode: DRY RUN' : 'Mode: REAL',
      '',
      'Progress:',
    ].filter(Boolean).join('\n');

    const progress = job.progress
      .map((p) => {
        const timestamp = new Date(p.timestamp).toISOString();
        const percentage = p.percentage !== undefined ? ` [${p.percentage}%]` : '';
        return `  ${timestamp}${percentage} [${p.code}] ${p.message}`;
      })
      .join('\n');

    const logs = ['\nLogs:', ...job.logs.map((l) => `  ${l.timestamp} [${l.level}] ${l.message}`)].join('\n');

    return [header, progress, logs].join('\n');
  }

  /**
   * Get job summary
   */
  getJobSummary(id: string): {
    id: string;
    platform: Platform;
    status: JobStatus;
    createdAt: string;
    duration?: string;
    progressPercentage: number;
    latestProgress?: string;
    errorCount: number;
    warningCount: number;
  } | null {
    const job = this.jobs.get(id);
    if (!job) {
      return null;
    }

    let duration: string | undefined;
    if (job.startedAt && job.completedAt) {
      const start = new Date(job.startedAt).getTime();
      const end = new Date(job.completedAt).getTime();
      const diff = end - start;
      duration = `${Math.floor(diff / 1000)}s`;
    }

    const errorCount = job.logs.filter((l) => l.level === 'ERROR').length;
    const warningCount = job.logs.filter((l) => l.level === 'WARN').length;
    const latestProgress = job.progress.length > 0 ? job.progress[job.progress.length - 1].message : undefined;

    return {
      id: job.id,
      platform: job.platform,
      status: job.status,
      createdAt: job.createdAt,
      duration,
      progressPercentage: this.getProgressPercentage(id),
      latestProgress,
      errorCount,
      warningCount,
    };
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    total: number;
    queued: number;
    running: number;
    waiting: number;
    succeeded: number;
    failed: number;
    cancelled: number;
  } {
    const jobs = this.listJobs();

    return {
      total: jobs.length,
      queued: jobs.filter((j) => j.status === JobStatus.QUEUED).length,
      running: jobs.filter((j) => j.status === JobStatus.RUNNING).length,
      waiting: jobs.filter((j) => j.status === JobStatus.WAITING).length,
      succeeded: jobs.filter((j) => j.status === JobStatus.SUCCEEDED).length,
      failed: jobs.filter((j) => j.status === JobStatus.FAILED).length,
      cancelled: jobs.filter((j) => j.status === JobStatus.CANCELLED).length,
    };
  }
}

// Singleton instance
export const jobReporter = new JobStatusReporter();
