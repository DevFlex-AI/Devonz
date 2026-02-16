/**
 * Secure secret management for mobile publishing
 * Handles base64 decoding, redaction, and secure in-memory handling
 */

/**
 * Redact secrets from logs and error messages
 */
export function redactSecrets(message: string, secrets: Record<string, string> = {}): string {
  let redacted = message;

  // Redact common secret patterns
  const patterns = [
    /sk-[a-zA-Z0-9]{20,}/g, // OpenAI-like API keys
    /[a-zA-Z0-9]{32,}/g, // Long alphanumeric strings (likely keys/tokens)
    /-----BEGIN [A-Z]+ KEY-----(.|\n)*?-----END [A-Z]+ KEY-----/g, // PEM keys
    /"key":\s*"[^"]{20,}"/g, // JSON keys
    /"private_key":\s*"[^"]{20,}"/g, // Private keys in JSON
  ];

  for (const pattern of patterns) {
    redacted = redacted.replace(pattern, '***REDACTED***');
  }

  // Redact specific provided secrets
  Object.entries(secrets).forEach(([key, value]) => {
    if (value && value.length > 10) {
      redacted = redacted.replace(new RegExp(value, 'g'), '***REDACTED***');
    }
  });

  return redacted;
}

/**
 * Securely decode base64 string to buffer
 * Buffer is zeroed after use when possible
 */
export function decodeBase64Secret(base64String: string | undefined): Buffer | null {
  if (!base64String) {
    return null;
  }

  try {
    return Buffer.from(base64String, 'base64');
  } catch (error) {
    console.error('Failed to decode base64 secret:', error);
    return null;
  }
}

/**
 * Decode base64 to string with secure handling
 */
export function decodeBase64ToString(base64String: string | undefined): string | null {
  const buffer = decodeBase64Secret(base64String);
  if (!buffer) {
    return null;
  }

  const result = buffer.toString('utf-8');

  // Clear the buffer from memory
  buffer.fill(0);

  return result;
}

/**
 * Clear a buffer securely by overwriting with zeros
 */
export function secureClearBuffer(buffer: Buffer | undefined): void {
  if (buffer) {
    buffer.fill(0);
  }
}

/**
 * Get environment variable with default value
 */
export function getEnvVar(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

/**
 * Get boolean environment variable
 */
export function getBoolEnvVar(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (!value) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Check if dry run mode is enabled
 */
export function isDryRun(): boolean {
  return getBoolEnvVar('PUBLISH_DRY_RUN', true);
}

/**
 * Get App Store Connect credentials securely
 */
export interface ASCCredentials {
  issuerId: string;
  keyId: string;
  privateKey: string;
  teamId?: string;
}

export function getASCCredentials(): ASCCredentials | null {
  const issuerId = getEnvVar('ASC_ISSUER_ID');
  const keyId = getEnvVar('ASC_KEY_ID');
  const privateKeyB64 = getEnvVar('ASC_PRIVATE_KEY_B64');
  const teamId = getEnvVar('ASC_TEAM_ID');

  if (!issuerId || !keyId || !privateKeyB64) {
    return null;
  }

  const privateKey = decodeBase64ToString(privateKeyB64);
  if (!privateKey) {
    return null;
  }

  return {
    issuerId,
    keyId,
    privateKey,
    teamId: teamId || undefined,
  };
}

/**
 * Get Google Play Service Account credentials securely
 */
export interface GooglePlayCredentials {
  serviceAccountJson: string;
}

export function getGooglePlayCredentials(): GooglePlayCredentials | null {
  const saJsonB64 = getEnvVar('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_B64');

  if (!saJsonB64) {
    return null;
  }

  const serviceAccountJson = decodeBase64ToString(saJsonB64);
  if (!serviceAccountJson) {
    return null;
  }

  return {
    serviceAccountJson,
  };
}

/**
 * Get Android signing credentials securely
 */
export interface AndroidSigningCredentials {
  keystore: Buffer;
  keyAlias: string;
  keystorePassword: string;
  keyPassword: string;
}

export function getAndroidSigningCredentials(): AndroidSigningCredentials | null {
  const keystoreB64 = getEnvVar('ANDROID_KEYSTORE_B64');
  const keyAlias = getEnvVar('ANDROID_KEY_ALIAS');
  const keystorePassword = getEnvVar('ANDROID_KEYSTORE_PASSWORD');
  const keyPassword = getEnvVar('ANDROID_KEY_PASSWORD');

  if (!keystoreB64 || !keyAlias || !keystorePassword || !keyPassword) {
    return null;
  }

  const keystore = decodeBase64Secret(keystoreB64);
  if (!keystore) {
    return null;
  }

  return {
    keystore,
    keyAlias,
    keystorePassword,
    keyPassword,
  };
}

/**
 * Clear Android signing credentials from memory
 */
export function clearAndroidSigningCredentials(creds: AndroidSigningCredentials | null): void {
  if (creds) {
    secureClearBuffer(creds.keystore);
  }
}

/**
 * Validate required secrets are present
 */
export interface SecretsValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

export function validateRequiredSecrets(): SecretsValidationResult {
  const result: SecretsValidationResult = {
    valid: true,
    missing: [],
    warnings: [],
  };

  // Check iOS credentials
  if (!getEnvVar('ASC_ISSUER_ID') || !getEnvVar('ASC_KEY_ID') || !getEnvVar('ASC_PRIVATE_KEY_B64')) {
    result.valid = false;
    result.missing.push('iOS App Store Connect credentials (ASC_ISSUER_ID, ASC_KEY_ID, ASC_PRIVATE_KEY_B64)');
  }

  // Check Android credentials
  if (
    !getEnvVar('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_B64')
  ) {
    result.valid = false;
    result.missing.push('Google Play service account JSON');
  }

  // Check Android signing (required for production)
  if (!getEnvVar('ANDROID_KEYSTORE_B64') || !getEnvVar('ANDROID_KEY_ALIAS')) {
    result.warnings.push(
      'Android signing credentials not set. Required for AAB/APK builds, but optional for metadata updates.',
    );
  }

  return result;
}

/**
 * Get app metadata from environment
 */
export interface AppMetadata {
  bundleIdIOS: string;
  packageNameAndroid: string;
  appName: string;
  privacyUrl: string;
  supportUrl: string;
}

export function getAppMetadata(): AppMetadata {
  return {
    bundleIdIOS: getEnvVar('APP_BUNDLE_ID_IOS', 'com.example.app'),
    packageNameAndroid: getEnvVar('APP_PACKAGE_NAME_ANDROID', 'com.example.app'),
    appName: getEnvVar('APP_NAME', 'My App'),
    privacyUrl: getEnvVar('APP_PRIVACY_URL', 'https://example.com/privacy'),
    supportUrl: getEnvVar('APP_SUPPORT_URL', 'https://example.com/support'),
  };
}

/**
 * Get EAS access token (for Expo EAS Submit)
 */
export function getEASAccessToken(): string | null {
  return getEnvVar('EAS_ACCESS_TOKEN') || null;
}
