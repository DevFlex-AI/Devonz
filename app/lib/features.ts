/**
 * Feature gates for mobile publishing and related features
 * In production, integrate with your billing/identity system
 */

export function hasFeature(feature: string): boolean {
  // Check environment variable for feature flags
  const envValue = process.env.MOBILE_FEATURES;
  if (envValue === '*') {
    return true;
  }

  // Check specific feature
  const enabledFeatures = envValue?.split(',').map((f) => f.trim().toLowerCase()) || [];

  // Check individual feature gates
  switch (feature.toLowerCase()) {
    case 'mobile_apps':
      return enabledFeatures.includes('mobile_apps') || process.env.NODE_ENV === 'development';

    case 'cloud_builds':
      return enabledFeatures.includes('cloud_builds') || process.env.NODE_ENV === 'development';

    case 'ota':
      return enabledFeatures.includes('ota') || process.env.NODE_ENV === 'development';

    case 'store_publish':
      // Require secrets to be configured in production
      const hasSecrets =
        process.env.ASC_ISSUER_ID ||
        process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_B64;

      return (
        (enabledFeatures.includes('store_publish') || process.env.NODE_ENV === 'development') &&
        (hasSecrets || process.env.NODE_ENV === 'development')
      );

    case 'flutter_support':
      return enabledFeatures.includes('flutter_support') || process.env.NODE_ENV === 'development';

    case 'react_native_support':
      return enabledFeatures.includes('react_native_support') || process.env.NODE_ENV === 'development';

    default:
      return false;
  }
}

/**
 * Check if any mobile features are enabled
 */
export function hasMobileFeatures(): boolean {
  return (
    hasFeature('mobile_apps') ||
    hasFeature('cloud_builds') ||
    hasFeature('ota') ||
    hasFeature('store_publish')
  );
}

/**
 * Get list of enabled features
 */
export function getEnabledFeatures(): string[] {
  const features = [
    'mobile_apps',
    'cloud_builds',
    'ota',
    'store_publish',
    'flutter_support',
    'react_native_support',
  ];

  return features.filter((feature) => hasFeature(feature));
}
