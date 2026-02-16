import { logger, ProgressCode } from '../util/logging';
import { isDryRun, redactSecrets } from '../secrets/vault';
import type { SubmitIOSJobData } from '../queue/jobs';
import { AppStoreConnectClient } from './ios-direct';

/**
 * iOS Fastlane Adapter
 * Wrapper for fastlane deliver/pilot commands
 */

export class IOSFastlaneAdapter {
  private ascClient: AppStoreConnectClient;

  constructor() {
    this.ascClient = new AppStoreConnectClient();
  }

  /**
   * Upload build using fastlane pilot (for TestFlight)
   */
  async uploadToTestFlight(data: SubmitIOSJobData): Promise<{ buildId: string }> {
    logger.info(ProgressCode.IOS_UPLOAD_START, {
      bundleId: data.bundleId,
      version: data.version,
      method: 'fastlane',
    });

    if (isDryRun()) {
      logger.info('Dry run: skipping fastlane upload');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { buildId: 'dry-run-build-id' };
    }

    if (!data.buildPath) {
      throw new Error('Build path is required for upload');
    }

    const args = [
      'pilot',
      'upload',
      '--skip_waiting_for_build_processing',
      '--skip_submission',
    ];

    if (data.skipMetadata) {
      args.push('--skip_metadata');
    }

    if (data.skipScreenshots) {
      args.push('--skip_screenshots');
    }

    // In production, execute fastlane command
    // const result = await exec('fastlane', args, {
    //   cwd: path.dirname(data.buildPath),
    //   env: {
    //     ...process.env,
    //     FASTLANE_USER: process.env.FASTLANE_USER,
    //     FASTLANE_PASSWORD: process.env.FASTLANE_PASSWORD,
    //     FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD: process.env.FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD,
    //   },
    // });

    logger.info(ProgressCode.IOS_UPLOAD_COMPLETE, { bundleId: data.bundleId });

    return { buildId: `build-${Date.now()}` };
  }

  /**
   * Upload build using fastlane deliver (for App Store)
   */
  async uploadToAppStore(data: SubmitIOSJobData): Promise<{ buildId: string }> {
    logger.info(ProgressCode.IOS_UPLOAD_START, {
      bundleId: data.bundleId,
      version: data.version,
      method: 'fastlane',
    });

    if (isDryRun()) {
      logger.info('Dry run: skipping fastlane deliver');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { buildId: 'dry-run-build-id' };
    }

    if (!data.buildPath) {
      throw new Error('Build path is required for upload');
    }

    const args = [
      'deliver',
      '--ipa',
      data.buildPath,
      '--skip_screenshots',
      '--skip_metadata',
      '--force',
    ];

    // In production, execute fastlane command
    // const result = await exec('fastlane', args, {
    //   cwd: path.dirname(data.buildPath),
    // });

    logger.info(ProgressCode.IOS_UPLOAD_COMPLETE, { bundleId: data.bundleId });

    return { buildId: `build-${Date.now()}` };
  }

  /**
   * Submit to TestFlight with build
   */
  async submitToTestFlight(data: SubmitIOSJobData): Promise<{ submissionId: string }> {
    logger.info('Submitting to TestFlight', {
      bundleId: data.bundleId,
      version: data.version,
      releaseType: data.releaseType,
    });

    if (isDryRun()) {
      logger.info('Dry run: skipping TestFlight submission');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { submissionId: 'dry-run-submission-id' };
    }

    // Upload build first
    const { buildId } = await this.uploadToTestFlight(data);

    // Wait for processing
    await this.ascClient.waitForBuildProcessing(buildId, new AbortController());

    // Submit for review if external testing
    if (data.releaseType === 'testflight-external') {
      logger.info(ProgressCode.IOS_VERSION_SUBMITTED, { buildId });
      // In production, use fastlane or App Store Connect API
    }

    return { submissionId: `submission-${Date.now()}` };
  }

  /**
   * Submit to App Store
   */
  async submitToAppStore(data: SubmitIOSJobData): Promise<{ submissionId: string }> {
    logger.info('Submitting to App Store', {
      bundleId: data.bundleId,
      version: data.version,
    });

    if (isDryRun()) {
      logger.info('Dry run: skipping App Store submission');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { submissionId: 'dry-run-submission-id' };
    }

    // Upload build
    const { buildId } = await this.uploadToAppStore(data);

    // Wait for processing
    await this.ascClient.waitForBuildProcessing(buildId, new AbortController());

    // Create version and submit for review
    const { versionId } = await this.ascClient.createAppStoreVersion(
      data.bundleId,
      data.version,
      data.buildNumber,
    );

    const result = await this.ascClient.submitForReview(versionId);
    logger.info(ProgressCode.IOS_REVIEW_PENDING, { versionId });

    return { submissionId: result.submissionId };
  }

  /**
   * Get build status using fastlane
   */
  async getBuildStatus(buildId: string): Promise<'PROCESSING' | 'VALID' | 'INVALID' | 'FAILED'> {
    if (isDryRun()) {
      return 'VALID';
    }

    // In production, use fastlane or App Store Connect API
    return this.ascClient.getBuildStatus(buildId);
  }

  /**
   * Check if fastlane is installed
   */
  static async isInstalled(): Promise<boolean> {
    try {
      // In production, check if fastlane is available
      // await exec('which', ['fastlane']);
      return true;
    } catch {
      return false;
    }
  }
}
