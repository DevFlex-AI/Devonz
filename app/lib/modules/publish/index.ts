/**
 * Publishing Orchestrator - Public API
 * Main façade for mobile app publishing to App Store Connect and Google Play
 */

import { v4 as uuidv4 } from 'crypto';
import {
  worker,
  createIOSSubmitJob,
  createAndroidSubmitJob,
  createValidateMetadataJob,
  createNormalizeAssetsJob,
  createPreflightCheckJob,
  type JobType,
  type JobPriority,
  type JobDefinition,
  type SubmitIOSJobData,
  type SubmitAndroidJobData,
  type ValidateMetadataJobData,
  type NormalizeAssetsJobData,
  type PreflightCheckJobData,
  type JobResult,
} from './queue';
import {
  jobReporter,
  JobStatus,
  Platform,
  type PublishJob,
} from './status';
import {
  type StoreMetadata,
  type IOSMetadata,
  type AndroidMetadata,
  validateStoreMetadata,
  runPreflightValidations,
} from './metadata';
import {
  normalizeAssets,
  getAssetValidationReport,
} from './assets';
import {
  validateRequiredSecrets,
  isDryRun,
  type ASCCredentials,
  type GooglePlayCredentials,
  type AndroidSigningCredentials,
} from './secrets';
import {
  logger,
  ProgressCode,
  LogEntry,
} from './util';

/**
 * Publishing orchestrator public API
 */

export interface SubmitOptions {
  dryRun?: boolean;
  priority?: JobPriority;
  skipMetadata?: boolean;
  skipScreenshots?: boolean;
  skipAssets?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  data?: any;
}

export interface PublishResult {
  jobId: string;
  status: JobStatus;
  platform: Platform;
  dryRun: boolean;
}

/**
 * Submit iOS app to App Store Connect or TestFlight
 */
export function submitIOS(
  data: SubmitIOSJobData,
  options: SubmitOptions = {},
): string {
  const jobId = uuidv4();
  logger.info(`Submitting iOS app: ${data.bundleId} v${data.version}`, {
    jobId,
    releaseType: data.releaseType,
    dryRun: options.dryRun,
  });

  const job = createIOSSubmitJob(data, {
    dryRun: options.dryRun ?? isDryRun(),
    priority: options.priority,
  });

  return worker.submitJob(job);
}

/**
 * Submit Android app to Google Play
 */
export function submitAndroid(
  data: SubmitAndroidJobData,
  options: SubmitOptions = {},
): string {
  const jobId = uuidv4();
  logger.info(`Submitting Android app: ${data.packageName} v${data.versionCode}`, {
    jobId,
    track: data.track,
    dryRun: options.dryRun,
  });

  const job = createAndroidSubmitJob(data, {
    dryRun: options.dryRun ?? isDryRun(),
    priority: options.priority,
  });

  return worker.submitJob(job);
}

/**
 * Validate store metadata
 */
export function validateMetadata(
  metadata: StoreMetadata,
  dryRun: boolean = true,
): string {
  const jobId = uuidv4();
  logger.info('Validating store metadata', { jobId, dryRun });

  const job = createValidateMetadataJob(metadata, { dryRun });
  return worker.submitJob(job);
}

/**
 * Normalize app assets (icons, screenshots)
 */
export function normalizeAssetsForPlatform(
  platform: Platform,
  assets: {
    icon: string;
    screenshots: Record<string, string[]>;
    featureGraphic?: string;
  },
  outputDir: string,
  options: { priority?: JobPriority } = {},
): string {
  const jobId = uuidv4();
  logger.info(`Normalizing assets for ${platform}`, { jobId });

  const job = createNormalizeAssetsJob(platform, assets, outputDir, options);
  return worker.submitJob(job);
}

/**
 * Run preflight validations
 */
export function runPreflight(
  metadata: StoreMetadata,
  platform: Platform,
  dryRun: boolean = true,
): string {
  const jobId = uuidv4();
  logger.info(`Running preflight check for ${platform}`, { jobId, dryRun });

  const job = createPreflightCheckJob(metadata, platform, { dryRun });
  return worker.submitJob(job);
}

/**
 * Get job status
 */
export function getJobStatus(jobId: string): PublishJob | undefined {
  return jobReporter.getJob(jobId);
}

/**
 * Get job summary
 */
export function getJobSummary(jobId: string) {
  return jobReporter.getJobSummary(jobId);
}

/**
 * Get job progress percentage
 */
export function getJobProgress(jobId: string): number {
  return jobReporter.getProgressPercentage(jobId);
}

/**
 * Get job logs
 */
export function getJobLogs(jobId: string): LogEntry[] {
  return jobReporter.getJobLogs(jobId);
}

/**
 * Export job logs
 */
export function exportJobLogs(jobId: string): string {
  return jobReporter.exportJobLogs(jobId);
}

/**
 * Cancel job
 */
export function cancelJob(jobId: string): void {
  worker.cancelJob(jobId);
}

/**
 * List all jobs
 */
export function listJobs(): PublishJob[] {
  return jobReporter.listJobs();
}

/**
 * Get queue statistics
 */
export function getQueueStatistics() {
  return worker.getStatistics();
}

/**
 * Get job statistics
 */
export function getJobStatistics() {
  return jobReporter.getStatistics();
}

/**
 * Validate secrets configuration
 */
export function validateSecrets(): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  return validateRequiredSecrets();
}

/**
 * Check if dry run mode is enabled
 */
export function isDryRunMode(): boolean {
  return isDryRun();
}

/**
 * Start the worker
 */
export function startWorker(intervalMs: number = 1000): void {
  worker.start(intervalMs);
}

/**
 * Stop the worker
 */
export function stopWorker(): void {
  worker.stop();
}

/**
 * Sync validation (returns result immediately)
 */
export async function validateMetadataSync(
  metadata: unknown,
): Promise<ValidationResult> {
  try {
    const result = await validateStoreMetadata(metadata);

    if (!result.valid) {
      return {
        valid: false,
        errors: result.errors.map((e) => `${e.field}: ${e.message}`),
        warnings: result.warnings.map((w) => w.message),
      };
    }

    return {
      valid: true,
      errors: [],
      warnings: result.warnings.map((w) => w.message),
    };
  } catch (error: any) {
    return {
      valid: false,
      errors: [error.message],
      warnings: [],
    };
  }
}

/**
 * Sync preflight check (returns result immediately)
 */
export async function runPreflightSync(
  metadata: StoreMetadata,
  dryRun: boolean = true,
): Promise<ValidationResult> {
  try {
    const result = await runPreflightValidations(metadata, dryRun);

    const errors = [
      ...result.results.schema.errors.map((e) => `${e.field}: ${e.message}`),
      ...result.results.completeness.errors.map((e) => `${e.field}: ${e.message}`),
      ...result.results.iosVersion.errors.map((e) => `${e.field}: ${e.message}`),
      ...result.results.androidVersion.errors.map((e) => `${e.field}: ${e.message}`),
    ];

    const warnings = [
      ...result.results.schema.warnings.map((w) => w.message),
      ...result.results.completeness.warnings.map((w) => w.message),
      ...result.results.iosVersion.warnings.map((w) => w.message),
      ...result.results.androidVersion.warnings.map((w) => w.message),
    ];

    return {
      valid: result.valid,
      errors,
      warnings,
      data: result.results,
    };
  } catch (error: any) {
    return {
      valid: false,
      errors: [error.message],
      warnings: [],
    };
  }
}

/**
 * Sync asset validation (returns result immediately)
 */
export async function validateAssetsSync(
  platform: Platform,
  assets: {
    icon: string;
    screenshots: Record<string, string[]>;
    featureGraphic?: string;
  },
): Promise<ValidationResult> {
  try {
    const report = await getAssetValidationReport(platform, assets);

    return {
      valid: report.valid,
      errors: report.errors,
      warnings: report.warnings,
      data: report.recommendations,
    };
  } catch (error: any) {
    return {
      valid: false,
      errors: [error.message],
      warnings: [],
    };
  }
}

/**
 * Get credential status
 */
export function getCredentialStatus(): {
  ios: { configured: boolean; hasCredentials: boolean };
  android: { configured: boolean; hasCredentials: boolean };
  androidSigning: { configured: boolean; hasCredentials: boolean };
  eas: { configured: boolean; hasCredentials: boolean };
} {
  const { validateRequiredSecrets } = require('./secrets');
  const result = validateRequiredSecrets();

  return {
    ios: {
      configured: !result.missing.some((m) => m.includes('iOS')),
      hasCredentials: !result.missing.some((m) => m.includes('iOS')),
    },
    android: {
      configured: !result.missing.some((m) => m.includes('Google Play')),
      hasCredentials: !result.missing.some((m) => m.includes('Google Play')),
    },
    androidSigning: {
      configured: !result.warnings.some((w) => w.includes('Android signing')),
      hasCredentials: !result.warnings.some((w) => w.includes('Android signing')),
    },
    eas: {
      configured: !!require('./secrets').getEASAccessToken(),
      hasCredentials: !!require('./secrets').getEASAccessToken(),
    },
  };
}

/**
 * Get sample store.json structure
 */
export function getSampleStoreMetadata(): StoreMetadata {
  return {
    ios: {
      bundleId: 'com.example.app',
      version: '1.0.0',
      buildNumber: '1',
      releaseType: 'testflight-internal',
      releaseNotes: 'Initial release',
      exportCompliance: {
        usesEncryption: false,
        isExempt: true,
      },
      reviewInformation: {
        contactFirstName: 'John',
        contactLastName: 'Doe',
        contactEmail: 'john@example.com',
        contactPhone: '+1234567890',
      },
      appInformation: {
        subtitle: 'My Awesome App',
        promotionalText: 'Check out our new app!',
        description: 'This is an amazing app that does amazing things.',
        keywords: ['productivity', 'utility', 'awesome'],
        privacyPolicyUrl: 'https://example.com/privacy',
        supportUrl: 'https://example.com/support',
        marketingUrl: 'https://example.com',
      },
      screenshots: {
        iphone67: ['path/to/screenshot1.png', 'path/to/screenshot2.png', 'path/to/screenshot3.png'],
        ipad129: ['path/to/ipad-screenshot1.png', 'path/to/ipad-screenshot2.png', 'path/to/ipad-screenshot3.png'],
      },
      appIcon: 'path/to/icon.png',
      ageRating: '4+',
      signInRequired: false,
    },
    android: {
      packageName: 'com.example.app',
      versionName: '1.0.0',
      versionCode: 1,
      track: 'internal',
      userFraction: 0.1,
      changelogs: {
        'en-US': 'Initial release',
      },
      listing: {
        title: 'My Awesome App',
        shortDescription: 'An amazing app for you'.padEnd(80, '.'),
        fullDescription: 'This is an amazing app that does amazing things.',
        privacyPolicyUrl: 'https://example.com/privacy',
      },
      graphics: {
        icon: 'path/to/icon.png',
        featureGraphic: 'path/to/feature.png',
      },
      screenshots: {
        phone: ['path/to/screenshot1.png', 'path/to/screenshot2.png'],
      },
      contentRating: {
        category: 'GENERAL',
        alcoholTobacco: 'NONE',
        drugs: 'NONE',
        gambling: 'NONE',
      },
      dataSafety: {
        collectsData: false,
        collectedData: [],
      },
    },
  };
}

// Export types
export type {
  StoreMetadata,
  IOSMetadata,
  AndroidMetadata,
  JobStatus,
  Platform,
  JobType,
  JobPriority,
  PublishJob,
  JobResult,
  SubmitIOSJobData,
  SubmitAndroidJobData,
  ValidateMetadataJobData,
  NormalizeAssetsJobData,
  PreflightCheckJobData,
  ASCCredentials,
  GooglePlayCredentials,
  AndroidSigningCredentials,
};

// Export enums
export { ProgressCode, LogLevel } from './util';
