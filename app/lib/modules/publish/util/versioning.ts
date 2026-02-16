/**
 * Version parsing and comparison utilities
 */

/**
 * Parse iOS version string (e.g., "1.4.0" or "1.4")
 */
export function parseIOSVersion(version: string): { major: number; minor: number; patch: number } {
  const parts = version.split('.').map(Number);

  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
  };
}

/**
 * Format iOS version string
 */
export function formatIOSVersion(major: number, minor: number, patch: number = 0): string {
  return `${major}.${minor}${patch > 0 ? `.${patch}` : ''}`;
}

/**
 * Compare iOS versions
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareIOSVersions(v1: string, v2: string): number {
  const ver1 = parseIOSVersion(v1);
  const ver2 = parseIOSVersion(v2);

  if (ver1.major !== ver2.major) return ver1.major < ver2.major ? -1 : 1;
  if (ver1.minor !== ver2.minor) return ver1.minor < ver2.minor ? -1 : 1;
  if (ver1.patch !== ver2.patch) return ver1.patch < ver2.patch ? -1 : 1;

  return 0;
}

/**
 * Increment iOS version
 */
export function incrementIOSVersion(
  version: string,
  type: 'major' | 'minor' | 'patch' = 'patch',
): string {
  const parsed = parseIOSVersion(version);

  switch (type) {
    case 'major':
      return formatIOSVersion(parsed.major + 1, 0, 0);
    case 'minor':
      return formatIOSVersion(parsed.major, parsed.minor + 1, 0);
    case 'patch':
      return formatIOSVersion(parsed.major, parsed.minor, parsed.patch + 1);
  }
}

/**
 * Parse Android version name (same format as iOS)
 */
export function parseAndroidVersionName(versionName: string): {
  major: number;
  minor: number;
  patch: number;
} {
  return parseIOSVersion(versionName);
}

/**
 * Format Android version name
 */
export function formatAndroidVersionName(major: number, minor: number, patch: number = 0): string {
  return formatIOSVersion(major, minor, patch);
}

/**
 * Convert version name to version code (simple algorithm)
 * versionCode = major * 10000 + minor * 100 + patch
 */
export function versionNameToCode(versionName: string): number {
  const parsed = parseAndroidVersionName(versionName);
  return parsed.major * 10000 + parsed.minor * 100 + parsed.patch;
}

/**
 * Increment version code
 */
export function incrementVersionCode(currentCode: number): number {
  return currentCode + 1;
}

/**
 * Suggest next build number for iOS
 */
export function suggestNextBuildNumber(currentBuildNumber: string): string {
  const num = parseInt(currentBuildNumber, 10);
  return String(isNaN(num) ? 1 : num + 1);
}

/**
 * Suggest next version code for Android
 */
export function suggestNextVersionCode(currentVersionCode: number): number {
  return currentVersionCode + 1;
}

/**
 * Validate build number format
 */
export function isValidBuildNumber(buildNumber: string): boolean {
  return /^\d+$/.test(buildNumber);
}

/**
 * Validate version code
 */
export function isValidVersionCode(versionCode: number): boolean {
  return Number.isInteger(versionCode) && versionCode > 0;
}

/**
 * Validate iOS version format
 */
export function isValidIOSVersion(version: string): boolean {
  return /^\d+\.\d+(\.\d+)?$/.test(version);
}

/**
 * Validate Android version name format
 */
export function isValidAndroidVersionName(versionName: string): boolean {
  return isValidIOSVersion(versionName);
}

/**
 * Generate beta version number
 * e.g., "1.4.0" -> "1.4.1-beta.1"
 */
export function generateBetaVersion(version: string, betaNumber: number = 1): string {
  const parsed = parseIOSVersion(version);
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}-beta.${betaNumber}`;
}

/**
 * Check if version is a beta/release candidate
 */
export function isPrereleaseVersion(version: string): boolean {
  return /-(beta|rc|alpha)\./.test(version);
}
