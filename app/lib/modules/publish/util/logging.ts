/**
 * Logging utilities for the publishing orchestrator
 * All secrets are automatically redacted
 */

import { redactSecrets } from '../secrets/vault';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  code?: string;
  message: string;
  data?: Record<string, unknown>;
  duration?: number;
}

class PublishLogger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  log(level: LogLevel, message: string, data?: Record<string, unknown>, code?: string): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      code,
      message: redactSecrets(message, data as Record<string, string>),
      data: data ? this.redactData(data) : undefined,
    };

    this.logs.push(entry);

    // Keep logs size bounded
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output with colors
    this.consoleLog(entry);

    return entry;
  }

  private redactData(data: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};

    Object.entries(data).forEach(([key, value]) => {
      if (typeof value === 'string' && value.length > 50) {
        redacted[key] = '***REDACTED***';
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = this.redactData(value as Record<string, unknown>);
      } else {
        redacted[key] = value;
      }
    });

    return redacted;
  }

  private consoleLog(entry: LogEntry): void {
    const prefix = {
      [LogLevel.DEBUG]: '\x1b[36m[DEBUG]\x1b[0m',
      [LogLevel.INFO]: '\x1b[32m[INFO]\x1b[0m',
      [LogLevel.WARN]: '\x1b[33m[WARN]\x1b[0m',
      [LogLevel.ERROR]: '\x1b[31m[ERROR]\x1b[0m',
    }[entry.level];

    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const code = entry.code ? ` [${entry.code}]` : '';
    const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';

    console.log(`${prefix} ${timestamp}${code} ${entry.message}${data}`);
  }

  debug(message: string, data?: Record<string, unknown>, code?: string): LogEntry {
    return this.log(LogLevel.DEBUG, message, data, code);
  }

  info(message: string, data?: Record<string, unknown>, code?: string): LogEntry {
    return this.log(LogLevel.INFO, message, data, code);
  }

  warn(message: string, data?: Record<string, unknown>, code?: string): LogEntry {
    return this.log(LogLevel.WARN, message, data, code);
  }

  error(message: string, data?: Record<string, unknown>, code?: string): LogEntry {
    return this.log(LogLevel.ERROR, message, data, code);
  }

  /**
   * Measure execution time
   */
  async measure<T>(
    code: string,
    fn: () => Promise<T>,
    level: LogLevel = LogLevel.INFO,
  ): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    this.log(LogLevel.DEBUG, `Starting ${code}`, {}, code);

    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.log(level, `Completed ${code}`, { duration: `${duration}ms` }, code);

      return { result, duration };
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`Failed ${code}`, { error: String(error), duration: `${duration}ms` }, code);
      throw error;
    }
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * Get logs by code
   */
  getLogsByCode(code: string): LogEntry[] {
    return this.logs.filter((log) => log.code === code);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Get logs as text for export
   */
  exportLogs(): string {
    return this.logs
      .map((log) => {
        const timestamp = new Date(log.timestamp).toISOString();
        const code = log.code ? ` [${log.code}]` : '';
        const data = log.data ? ` ${JSON.stringify(log.data)}` : '';
        return `${timestamp} [${log.level}]${code} ${log.message}${data}`;
      })
      .join('\n');
  }
}

// Singleton logger instance
export const logger = new PublishLogger();

/**
 * Progress event codes for job status reporting
 */
export enum ProgressCode {
  // Common
  JOB_STARTED = 'JOB_STARTED',
  JOB_COMPLETED = 'JOB_COMPLETED',
  JOB_FAILED = 'JOB_FAILED',
  JOB_CANCELLED = 'JOB_CANCELLED',

  // iOS
  IOS_VALIDATION_START = 'IOS_VALIDATION_START',
  IOS_VALIDATION_COMPLETE = 'IOS_VALIDATION_COMPLETE',
  IOS_UPLOAD_START = 'IOS_UPLOAD_START',
  IOS_UPLOAD_COMPLETE = 'IOS_UPLOAD_COMPLETE',
  IOS_BUILD_PROCESSING = 'IOS_BUILD_PROCESSING',
  IOS_BUILD_PROCESSED = 'IOS_BUILD_PROCESSED',
  IOS_VERSION_SUBMITTED = 'IOS_VERSION_SUBMITTED',
  IOS_REVIEW_PENDING = 'IOS_REVIEW_PENDING',
  IOS_REVIEW_APPROVED = 'IOS_REVIEW_APPROVED',
  IOS_REVIEW_REJECTED = 'IOS_REVIEW_REJECTED',
  IOS_TESTERS_INVITED = 'IOS_TESTERS_INVITED',

  // Android
  ANDROID_VALIDATION_START = 'ANDROID_VALIDATION_START',
  ANDROID_VALIDATION_COMPLETE = 'ANDROID_VALIDATION_COMPLETE',
  ANDROID_UPLOAD_START = 'ANDROID_UPLOAD_START',
  ANDROID_UPLOAD_COMPLETE = 'ANDROID_UPLOAD_COMPLETE',
  ANDROID_EDIT_CREATED = 'ANDROID_EDIT_CREATED',
  ANDROID_TRACK_ASSIGNED = 'ANDROID_TRACK_ASSIGNED',
  ANDROID_RELEASE_NOTES_ADDED = 'ANDROID_RELEASE_NOTES_ADDED',
  ANDROID_EDIT_COMMITTED = 'ANDROID_EDIT_COMMITTED',
  ANDROID_ROLLOUT_STARTED = 'ANDROID_ROLLOUT_STARTED',
  ANDROID_ROLLOUT_EXPANDED = 'ANDROID_ROLLOUT_EXPANDED',
  ANDROID_ROLLOUT_HALTED = 'ANDROID_ROLLOUT_HALTED',
  ANDROID_ROLLBACK_COMPLETE = 'ANDROID_ROLLBACK_COMPLETE',

  // Assets
  ASSET_NORMALIZATION_START = 'ASSET_NORMALIZATION_START',
  ASSET_NORMALIZATION_COMPLETE = 'ASSET_NORMALIZATION_COMPLETE',
  ASSET_VALIDATION_ERROR = 'ASSET_VALIDATION_ERROR',

  // Metadata
  METADATA_UPLOAD_START = 'METADATA_UPLOAD_START',
  METADATA_UPLOAD_COMPLETE = 'METADATA_UPLOAD_COMPLETE',
  METADATA_VALIDATION_ERROR = 'METADATA_VALIDATION_ERROR',
}
