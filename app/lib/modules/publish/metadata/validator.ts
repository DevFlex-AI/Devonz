import { storeSchema, type StoreMetadata, type IOSMetadata, type AndroidMetadata } from './schema';
import { getAppStoreConnectClient, getPlayDeveloperClient } from '../adapters/index';
import { redactSecrets } from '../secrets/vault';

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ field: string; message: string; severity: 'error' | 'warning' }>;
  warnings: Array<{ field: string; message: string }>;
}

export interface VersionValidationResult extends ValidationResult {
  lastVersion?: string;
  lastBuildNumber?: string;
  suggestedBuildNumber?: string;
}

export interface AndroidVersionValidationResult extends ValidationResult {
  lastVersionCode?: number;
  suggestedVersionCode?: number;
}

/**
 * Validate store metadata against schema
 */
export async function validateStoreMetadata(metadata: unknown): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  try {
    storeSchema.parse(metadata);
  } catch (error: any) {
    result.valid = false;
    error.errors.forEach((err: any) => {
      result.errors.push({
        field: err.path.join('.'),
        message: err.message,
        severity: 'error' as const,
      });
    });
  }

  return result;
}

/**
 * Validate iOS versioning against App Store Connect
 */
export async function validateIOSVersioning(
  bundleId: string,
  version: string,
  buildNumber: string,
  dryRun: boolean = true,
): Promise<VersionValidationResult> {
  const result: VersionValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  try {
    const ascClient = getAppStoreConnectClient();
    const lastVersion = await ascClient.getLastVersion(bundleId);
    const lastBuildNumber = await ascClient.getLastBuildNumber(bundleId);

    if (lastVersion && version === lastVersion) {
      const currentBuildNum = parseInt(buildNumber, 10);
      const lastBuildNum = parseInt(lastBuildNumber || '0', 10);

      if (currentBuildNum <= lastBuildNum) {
        result.valid = false;
        result.errors.push({
          field: 'ios.buildNumber',
          message: `Build number must increase. Last build number was ${lastBuildNumber}, new is ${currentBuildNum}`,
          severity: 'error',
        });
        result.suggestedBuildNumber = String(lastBuildNum + 1);
      }
    }

    if (lastVersion) {
      const [major, minor, patch] = version.split('.').map(Number);
      const [lastMajor, lastMinor, lastPatch] = lastVersion.split('.').map(Number);

      if (major < lastMajor || (major === lastMajor && minor < lastMinor)) {
        result.errors.push({
          field: 'ios.version',
          message: `Version number should not decrease. Last version was ${lastVersion}, new is ${version}`,
          severity: 'warning',
        });
      }
    }

    result.lastVersion = lastVersion;
    result.lastBuildNumber = lastBuildNumber;
  } catch (error: any) {
    if (dryRun) {
      result.warnings.push({
        field: 'ios',
        message: `Dry run: Skipping App Store Connect version check - ${redactSecrets(error.message)}`,
      });
    } else {
      result.valid = false;
      result.errors.push({
        field: 'ios',
        message: `Failed to validate iOS versioning: ${redactSecrets(error.message)}`,
        severity: 'error',
      });
    }
  }

  return result;
}

/**
 * Validate Android versioning against Google Play
 */
export async function validateAndroidVersioning(
  packageName: string,
  versionCode: number,
  dryRun: boolean = true,
): Promise<AndroidVersionValidationResult> {
  const result: AndroidVersionValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  try {
    const playClient = getPlayDeveloperClient();
    const lastVersionCode = await playClient.getLastVersionCode(packageName);

    if (lastVersionCode && versionCode <= lastVersionCode) {
      result.valid = false;
      result.errors.push({
        field: 'android.versionCode',
        message: `Version code must be strictly increasing. Last version code was ${lastVersionCode}, new is ${versionCode}`,
        severity: 'error',
      });
      result.suggestedVersionCode = lastVersionCode + 1;
    }

    result.lastVersionCode = lastVersionCode;
  } catch (error: any) {
    if (dryRun) {
      result.warnings.push({
        field: 'android',
        message: `Dry run: Skipping Google Play version check - ${redactSecrets(error.message)}`,
      });
    } else {
      result.valid = false;
      result.errors.push({
        field: 'android',
        message: `Failed to validate Android versioning: ${redactSecrets(error.message)}`,
        severity: 'error',
      });
    }
  }

  return result;
}

/**
 * Validate that all required metadata fields are present
 */
export async function validateMetadataCompleteness(metadata: StoreMetadata): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // iOS validation
  const ios = metadata.ios;
  if (!ios.reviewInformation.contactEmail) {
    result.errors.push({
      field: 'ios.reviewInformation.contactEmail',
      message: 'Review contact email is required',
      severity: 'error',
    });
  }

  if (!ios.appInformation.description || ios.appInformation.description.length < 10) {
    result.errors.push({
      field: 'ios.appInformation.description',
      message: 'App description must be at least 10 characters',
      severity: 'error',
    });
  }

  if (!ios.appInformation.privacyPolicyUrl) {
    result.errors.push({
      field: 'ios.appInformation.privacyPolicyUrl',
      message: 'Privacy policy URL is required',
      severity: 'error',
    });
  }

  if (ios.screenshots.iphone67.length < 3) {
    result.errors.push({
      field: 'ios.screenshots.iphone67',
      message: 'At least 3 iPhone 6.7" screenshots are required',
      severity: 'error',
    });
  }

  // Android validation
  const android = metadata.android;
  if (!android.listing.title || android.listing.title.length > 30) {
    result.errors.push({
      field: 'android.listing.title',
      message: 'Title is required and must be 30 characters or less',
      severity: 'error',
    });
  }

  if (!android.listing.shortDescription || android.listing.shortDescription.length !== 80) {
    result.warnings.push({
      field: 'android.listing.shortDescription',
      message: 'Short description should be exactly 80 characters for optimal display',
    });
  }

  if (!android.listing.privacyPolicyUrl) {
    result.errors.push({
      field: 'android.listing.privacyPolicyUrl',
      message: 'Privacy policy URL is required',
      severity: 'error',
    });
  }

  if (!android.dataSafety || !android.dataSafety.collectedData || android.dataSafety.collectedData.length === 0) {
    result.errors.push({
      field: 'android.dataSafety',
      message: 'Data safety information is required',
      severity: 'error',
    });
  }

  return result;
}

/**
 * Validate export compliance for iOS
 */
export function validateExportCompliance(usesEncryption: boolean, isExempt: boolean): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (usesEncryption && !isExempt) {
    result.warnings.push({
      field: 'ios.exportCompliance',
      message: 'App uses encryption and is not exempt. This may require additional documentation and review time.',
    });
  }

  return result;
}

/**
 * Validate staged rollout configuration for Android
 */
export function validateStagedRollout(track: string, userFraction: number): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (track === 'production' && (userFraction <= 0 || userFraction > 1)) {
    result.errors.push({
      field: 'android.userFraction',
      message: 'User fraction must be between 0 and 1 for production staged rollout',
      severity: 'error',
    });
  }

  if (track !== 'production' && userFraction > 0) {
    result.warnings.push({
      field: 'android.userFraction',
      message: 'Staged rollout is only available for production track',
    });
  }

  return result;
}

/**
 * Run all validations for a store submission
 */
export async function runPreflightValidations(
  metadata: StoreMetadata,
  dryRun: boolean = true,
): Promise<{
  valid: boolean;
  results: {
    schema: ValidationResult;
    completeness: ValidationResult;
    iosVersion: VersionValidationResult;
    androidVersion: AndroidVersionValidationResult;
    exportCompliance: ValidationResult;
    stagedRollout: ValidationResult;
  };
}> {
  const [schema, completeness] = await Promise.all([
    validateStoreMetadata(metadata),
    validateMetadataCompleteness(metadata),
  ]);

  const [iosVersion, androidVersion] = await Promise.all([
    validateIOSVersioning(
      metadata.ios.bundleId,
      metadata.ios.version,
      metadata.ios.buildNumber,
      dryRun,
    ),
    validateAndroidVersioning(
      metadata.android.packageName,
      metadata.android.versionCode,
      dryRun,
    ),
  ]);

  const exportCompliance = validateExportCompliance(
    metadata.ios.exportCompliance.usesEncryption,
    metadata.ios.exportCompliance.isExempt,
  );

  const stagedRollout = validateStagedRollout(
    metadata.android.track,
    metadata.android.userFraction ?? 0,
  );

  const allValid =
    schema.valid &&
    completeness.valid &&
    iosVersion.valid &&
    androidVersion.valid &&
    exportCompliance.valid &&
    stagedRollout.valid;

  return {
    valid: allValid,
    results: {
      schema,
      completeness,
      iosVersion,
      androidVersion,
      exportCompliance,
      stagedRollout,
    },
  };
}
