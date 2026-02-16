import { v4 as uuidv4 } from 'crypto';
import { Platform, JobStatus, PublishJob } from '../status/reporter';
import { type StoreMetadata } from '../metadata';

/**
 * Job definitions and types for the publishing queue
 */

export interface JobDefinition<T = unknown> {
  id: string;
  type: JobType;
  platform: Platform;
  priority: JobPriority;
  status: JobStatus;
  data: T;
  createdAt: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  retryCount: number;
  maxRetries: number;
  dryRun: boolean;
  error?: string;
  result?: unknown;
}

export enum JobType {
  // iOS jobs
  IOS_SUBMIT_TESTFLIGHT_INTERNAL = 'IOS_SUBMIT_TESTFLIGHT_INTERNAL',
  IOS_SUBMIT_TESTFLIGHT_EXTERNAL = 'IOS_SUBMIT_TESTFLIGHT_EXTERNAL',
  IOS_SUBMIT_APP_STORE = 'IOS_SUBMIT_APP_STORE',
  IOS_METADATA_UPDATE = 'IOS_METADATA_UPDATE',
  IOS_BUILD_UPLOAD = 'IOS_BUILD_UPLOAD',

  // Android jobs
  ANDROID_SUBMIT_INTERNAL = 'ANDROID_SUBMIT_INTERNAL',
  ANDROID_SUBMIT_ALPHA = 'ANDROID_SUBMIT_ALPHA',
  ANDROID_SUBMIT_BETA = 'ANDROID_SUBMIT_BETA',
  ANDROID_SUBMIT_PRODUCTION = 'ANDROID_SUBMIT_PRODUCTION',
  ANDROID_METADATA_UPDATE = 'ANDROID_METADATA_UPDATE',
  ANDROID_BUILD_UPLOAD = 'ANDROID_BUILD_UPLOAD',
  ANDROID_ROLLOUT_EXPAND = 'ANDROID_ROLLOUT_EXPAND',
  ANDROID_ROLLOUT_HALT = 'ANDROID_ROLLOUT_HALT',
  ANDROID_ROLLBACK = 'ANDROID_ROLLBACK',

  // Common jobs
  VALIDATE_METADATA = 'VALIDATE_METADATA',
  NORMALIZE_ASSETS = 'NORMALIZE_ASSETS',
  PREFLIGHT_CHECK = 'PREFLIGHT_CHECK',
}

export enum JobPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

export interface SubmitIOSJobData {
  bundleId: string;
  version: string;
  buildNumber: string;
  buildPath?: string;
  metadata?: StoreMetadata;
  releaseType: 'testflight-internal' | 'testflight-external' | 'appStore';
  skipMetadata?: boolean;
  skipScreenshots?: boolean;
}

export interface SubmitAndroidJobData {
  packageName: string;
  versionName: string;
  versionCode: number;
  buildPath?: string;
  metadata?: StoreMetadata;
  track: 'internal' | 'alpha' | 'beta' | 'production';
  userFraction?: number;
  skipMetadata?: boolean;
  skipScreenshots?: boolean;
}

export interface ValidateMetadataJobData {
  metadata: StoreMetadata;
  dryRun: boolean;
}

export interface NormalizeAssetsJobData {
  platform: Platform;
  assets: {
    icon: string;
    screenshots: Record<string, string[]>;
    featureGraphic?: string;
  };
  outputDir: string;
}

export interface PreflightCheckJobData {
  metadata: StoreMetadata;
  dryRun: boolean;
  platform: Platform;
}

/**
 * Create a new job definition
 */
export function createJob<T = unknown>(
  type: JobType,
  platform: Platform,
  data: T,
  options: {
    priority?: JobPriority;
    dryRun?: boolean;
    maxRetries?: number;
    scheduledAt?: string;
  } = {},
): JobDefinition<T> {
  return {
    id: uuidv4(),
    type,
    platform,
    priority: options.priority ?? JobPriority.NORMAL,
    status: JobStatus.QUEUED,
    data,
    createdAt: new Date().toISOString(),
    scheduledAt: options.scheduledAt,
    retryCount: 0,
    maxRetries: options.maxRetries ?? 3,
    dryRun: options.dryRun ?? true,
  };
}

/**
 * Create iOS submission job
 */
export function createIOSSubmitJob(
  data: SubmitIOSJobData,
  options: { dryRun?: boolean; priority?: JobPriority } = {},
): JobDefinition<SubmitIOSJobData> {
  const releaseTypeToJobType: Record<
    SubmitIOSJobData['releaseType'],
    JobType
  > = {
    'testflight-internal': JobType.IOS_SUBMIT_TESTFLIGHT_INTERNAL,
    'testflight-external': JobType.IOS_SUBMIT_TESTFLIGHT_EXTERNAL,
    'appStore': JobType.IOS_SUBMIT_APP_STORE,
  };

  return createJob(releaseTypeToJobType[data.releaseType], Platform.IOS, data, options);
}

/**
 * Create Android submission job
 */
export function createAndroidSubmitJob(
  data: SubmitAndroidJobData,
  options: { dryRun?: boolean; priority?: JobPriority } = {},
): JobDefinition<SubmitAndroidJobData> {
  const trackToJobType: Record<SubmitAndroidJobData['track'], JobType> = {
    internal: JobType.ANDROID_SUBMIT_INTERNAL,
    alpha: JobType.ANDROID_SUBMIT_ALPHA,
    beta: JobType.ANDROID_SUBMIT_BETA,
    production: JobType.ANDROID_SUBMIT_PRODUCTION,
  };

  return createJob(trackToJobType[data.track], Platform.ANDROID, data, options);
}

/**
 * Create metadata validation job
 */
export function createValidateMetadataJob(
  metadata: StoreMetadata,
  options: { dryRun?: boolean } = {},
): JobDefinition<ValidateMetadataJobData> {
  return createJob(JobType.VALIDATE_METADATA, Platform.BOTH, { metadata, dryRun: options.dryRun ?? true });
}

/**
 * Create asset normalization job
 */
export function createNormalizeAssetsJob(
  platform: Platform,
  assets: NormalizeAssetsJobData['assets'],
  outputDir: string,
  options: { priority?: JobPriority } = {},
): JobDefinition<NormalizeAssetsJobData> {
  return createJob(JobType.NORMALIZE_ASSETS, platform, { platform, assets, outputDir }, options);
}

/**
 * Create preflight check job
 */
export function createPreflightCheckJob(
  metadata: StoreMetadata,
  platform: Platform,
  options: { dryRun?: boolean } = {},
): JobDefinition<PreflightCheckJobData> {
  return createJob(JobType.PREFLIGHT_CHECK, platform, { metadata, dryRun: options.dryRun ?? true, platform });
}

/**
 * Check if job should retry
 */
export function shouldRetryJob(job: JobDefinition): boolean {
  return job.retryCount < job.maxRetries && job.status === JobStatus.FAILED;
}

/**
 * Calculate backoff delay for retry (exponential backoff)
 */
export function calculateRetryDelay(retryCount: number, baseDelay: number = 1000): number {
  return baseDelay * Math.pow(2, retryCount);
}

/**
 * Job result wrapper
 */
export interface JobResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  warnings: string[];
  duration?: number;
}

/**
 * Create successful job result
 */
export function createJobResult<T>(data: T, warnings: string[] = []): JobResult<T> {
  return {
    success: true,
    data,
    warnings,
  };
}

/**
 * Create failed job result
 */
export function createJobErrorResult(error: string, warnings: string[] = []): JobResult {
  return {
    success: false,
    error,
    warnings,
  };
}
