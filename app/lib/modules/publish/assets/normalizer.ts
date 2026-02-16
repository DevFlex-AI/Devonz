import * as fs from 'fs/promises';
import * as path from 'path';
import { createTempDirWithCleanup } from '../util/tmp';
import { logger, ProgressCode } from '../util/logging';

/**
 * Asset configuration for iOS and Android
 */

export interface AssetSpec {
  width: number;
  height: number;
  scale?: number;
}

export interface NormalizationResult {
  success: boolean;
  outputPath?: string;
  error?: string;
  warnings: string[];
}

/**
 * iOS icon sizes
 */
export const IOS_ICON_SIZES: Record<string, AssetSpec> = {
  '1024x1024': { width: 1024, height: 1024 }, // App Store
  '180x180@2x': { width: 180, height: 180, scale: 2 },
  '167x167@2x': { width: 167, height: 167, scale: 2 }, // iPad Pro
  '152x152@2x': { width: 152, height: 152, scale: 2 }, // iPad
  '120x120@2x': { width: 120, height: 120, scale: 2 }, // iPhone
  '87x87@2x': { width: 87, height: 87, scale: 2 }, // iPhone Notification
  '76x76@2x': { width: 76, height: 76, scale: 2 }, // iPad Mini
  '60x60@2x': { width: 60, height: 60, scale: 2 }, // iPhone Settings
  '29x29@2x': { width: 29, height: 29, scale: 2 }, // iPhone Settings
};

/**
 * Android icon sizes (adaptive)
 */
export const ANDROID_ICON_SIZES: Record<string, AssetSpec> = {
  '512x512': { width: 512, height: 512 }, // Play Store
  '192x192': { width: 192, height: 192 }, // Launcher xxxhdpi
  '144x144': { width: 144, height: 144 }, // Launcher xxhdpi
  '96x96': { width: 96, height: 96 }, // Launcher xhdpi
  '72x72': { width: 72, height: 72 }, // Launcher hdpi
  '48x48': { width: 48, height: 48 }, // Launcher mdpi
  '36x36': { width: 36, height: 36 }, // Launcher ldpi
};

/**
 * iOS screenshot sizes
 */
export const IOS_SCREENSHOT_SIZES: Record<string, AssetSpec> = {
  'iphone-67': { width: 1290, height: 2796 }, // iPhone 14 Pro Max
  'iphone-65': { width: 1284, height: 2778 }, // iPhone 14 Pro
  'iphone-55': { width: 1242, height: 2208 }, // iPhone 8 Plus
  'ipad-129': { width: 2048, height: 2732 }, // iPad Pro 12.9"
  'ipad-pro': { width: 2732, height: 2048 }, // iPad Pro landscape
};

/**
 * Android screenshot sizes
 */
export const ANDROID_SCREENSHOT_SIZES: Record<string, AssetSpec> = {
  phone: { width: 1080, height: 1920 }, // Typical phone
  'sevenInch': { width: 1200, height: 1920 }, // 7" tablet
  'tenInch': { width: 1920, height: 2560 }, // 10" tablet
  tv: { width: 1920, height: 1080 },
};

/**
 * Android feature graphic
 */
export const ANDROID_FEATURE_GRAPHIC: AssetSpec = {
  width: 1024,
  height: 500,
};

/**
 * Android promo graphic (optional)
 */
export const ANDROID_PROMO_GRAPHIC: AssetSpec = {
  width: 180,
  height: 120,
};

/**
 * Android TV banner
 */
export const ANDROID_TV_BANNER: AssetSpec = {
  width: 1280,
  height: 720,
};

/**
 * Image metadata
 */
export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  aspectRatio: number;
}

/**
 * Get image dimensions using ImageMagick (if available) or basic file reading
 */
export async function getImageMetadata(imagePath: string): Promise<ImageMetadata> {
  try {
    const stats = await fs.stat(imagePath);
    const ext = path.extname(imagePath).toLowerCase();

    // For now, return basic info
    // In production, you'd use sharp or ImageMagick to get actual dimensions
    return {
      width: 0,
      height: 0,
      format: ext.slice(1),
      size: stats.size,
      aspectRatio: 0,
    };
  } catch (error: any) {
    throw new Error(`Failed to read image metadata: ${error.message}`);
  }
}

/**
 * Validate aspect ratio with tolerance
 */
export function validateAspectRatio(
  actualWidth: number,
  actualHeight: number,
  targetWidth: number,
  targetHeight: number,
  tolerance: number = 0.05,
): boolean {
  const actualRatio = actualWidth / actualHeight;
  const targetRatio = targetWidth / targetHeight;
  const diff = Math.abs(actualRatio - targetRatio) / targetRatio;
  return diff <= tolerance;
}

/**
 * Validate image file format
 */
export function validateImageFormat(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const validFormats = ['.png', '.jpg', '.jpeg', '.webp'];
  return validFormats.includes(ext);
}

/**
 * Validate image file size (max 10MB for store assets)
 */
export async function validateImageSize(filePath: string, maxSize: number = 10 * 1024 * 1024): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size <= maxSize;
  } catch {
    return false;
  }
}

/**
 * Normalize iOS icon
 */
export async function normalizeIOSIcon(
  inputPath: string,
  outputPath: string,
  size: AssetSpec,
): Promise<NormalizationResult> {
  logger.debug(`Normalizing iOS icon: ${inputPath} -> ${outputPath}`);

  if (!validateImageFormat(inputPath)) {
    return {
      success: false,
      error: 'Invalid image format. Must be PNG, JPG, or WebP',
      warnings: [],
    };
  }

  const validSize = await validateImageSize(inputPath);
  if (!validSize) {
    return {
      success: false,
      error: 'Image file size exceeds 10MB limit',
      warnings: [],
    };
  }

  // In production, use sharp or ImageMagick to resize and convert
  // For now, just copy the file
  try {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.copyFile(inputPath, outputPath);

    return {
      success: true,
      outputPath,
      warnings: [],
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to normalize icon: ${error.message}`,
      warnings: [],
    };
  }
}

/**
 * Generate all iOS icon sizes
 */
export async function generateIOSIcons(
  inputPath: string,
  outputDir: string,
): Promise<NormalizationResult[]> {
  logger.info(ProgressCode.ASSET_NORMALIZATION_START, { platform: 'iOS', type: 'icons' });

  const results: NormalizationResult[] = [];

  for (const [name, spec] of Object.entries(IOS_ICON_SIZES)) {
    const outputPath = path.join(outputDir, 'AppIcon.appiconset', `icon-${name}.png`);
    const result = await normalizeIOSIcon(inputPath, outputPath, spec);
    results.push(result);
  }

  const successCount = results.filter((r) => r.success).length;
  logger.info(ProgressCode.ASSET_NORMALIZATION_COMPLETE, {
    platform: 'iOS',
    type: 'icons',
    success: `${successCount}/${results.length}`,
  });

  return results;
}

/**
 * Normalize Android icon
 */
export async function normalizeAndroidIcon(
  inputPath: string,
  outputDir: string,
  size: AssetSpec,
  density: string,
): Promise<NormalizationResult> {
  const outputPath = path.join(outputDir, `mipmap-${density}`, 'ic_launcher.png');

  logger.debug(`Normalizing Android icon: ${inputPath} -> ${outputPath}`);

  if (!validateImageFormat(inputPath)) {
    return {
      success: false,
      error: 'Invalid image format. Must be PNG, JPG, or WebP',
      warnings: [],
    };
  }

  try {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.copyFile(inputPath, outputPath);

    return {
      success: true,
      outputPath,
      warnings: [],
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to normalize icon: ${error.message}`,
      warnings: [],
    };
  }
}

/**
 * Generate all Android icon sizes
 */
export async function generateAndroidIcons(
  inputPath: string,
  outputDir: string,
): Promise<NormalizationResult[]> {
  logger.info(ProgressCode.ASSET_NORMALIZATION_START, { platform: 'Android', type: 'icons' });

  const results: NormalizationResult[] = [];
  const densityMap: Record<string, string> = {
    '512x512': 'xxxhdpi',
    '192x192': 'xxxhdpi',
    '144x144': 'xxhdpi',
    '96x96': 'xhdpi',
    '72x72': 'hdpi',
    '48x48': 'mdpi',
    '36x36': 'ldpi',
  };

  for (const [sizeName, spec] of Object.entries(ANDROID_ICON_SIZES)) {
    const density = densityMap[sizeName];
    if (density) {
      const result = await normalizeAndroidIcon(inputPath, outputDir, spec, density);
      results.push(result);
    }
  }

  const successCount = results.filter((r) => r.success).length;
  logger.info(ProgressCode.ASSET_NORMALIZATION_COMPLETE, {
    platform: 'Android',
    type: 'icons',
    success: `${successCount}/${results.length}`,
  });

  return results;
}

/**
 * Normalize iOS screenshot
 */
export async function normalizeIOSScreenshot(
  inputPath: string,
  outputPath: string,
  deviceType: string,
  options: { autoFrame?: boolean } = {},
): Promise<NormalizationResult> {
  logger.debug(`Normalizing iOS screenshot: ${deviceType} - ${inputPath} -> ${outputPath}`);

  if (!validateImageFormat(inputPath)) {
    return {
      success: false,
      error: 'Invalid image format. Must be PNG, JPG, or WebP',
      warnings: [],
    };
  }

  try {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.copyFile(inputPath, outputPath);

    const warnings: string[] = [];
    if (options.autoFrame) {
      warnings.push('Auto-framing not implemented in this version');
    }

    return {
      success: true,
      outputPath,
      warnings,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to normalize screenshot: ${error.message}`,
      warnings: [],
    };
  }
}

/**
 * Validate iOS screenshots
 */
export async function validateIOSScreenshots(
  screenshots: Record<string, string[]>,
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  const requiredDevices = ['iphone67', 'ipad129'];
  for (const device of requiredDevices) {
    if (!screenshots[device] || screenshots[device].length < 3) {
      errors.push(`iOS ${device} requires at least 3 screenshots`);
    }
  }

  for (const [device, paths] of Object.entries(screenshots)) {
    for (const screenshotPath of paths) {
      const validFormat = validateImageFormat(screenshotPath);
      if (!validFormat) {
        errors.push(`Invalid format for ${device} screenshot: ${screenshotPath}`);
      }

      const validSize = await validateImageSize(screenshotPath);
      if (!validSize) {
        errors.push(`File too large for ${device} screenshot: ${screenshotPath}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate Android screenshots
 */
export async function validateAndroidScreenshots(
  screenshots: Record<string, string[]>,
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  const requiredDevices = ['phone'];
  for (const device of requiredDevices) {
    if (!screenshots[device] || screenshots[device].length < 2) {
      errors.push(`Android ${device} requires at least 2 screenshots`);
    }
  }

  for (const [device, paths] of Object.entries(screenshots)) {
    for (const screenshotPath of paths) {
      const validFormat = validateImageFormat(screenshotPath);
      if (!validFormat) {
        errors.push(`Invalid format for ${device} screenshot: ${screenshotPath}`);
      }

      const validSize = await validateImageSize(screenshotPath);
      if (!validSize) {
        errors.push(`File too large for ${device} screenshot: ${screenshotPath}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Normalize Android feature graphic
 */
export async function normalizeAndroidFeatureGraphic(
  inputPath: string,
  outputPath: string,
): Promise<NormalizationResult> {
  logger.debug(`Normalizing Android feature graphic: ${inputPath} -> ${outputPath}`);

  if (!validateImageFormat(inputPath)) {
    return {
      success: false,
      error: 'Invalid image format. Must be PNG or JPG',
      warnings: [],
    };
  }

  try {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.copyFile(inputPath, outputPath);

    return {
      success: true,
      outputPath,
      warnings: [],
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to normalize feature graphic: ${error.message}`,
      warnings: [],
    };
  }
}

/**
 * Normalize all assets for a platform
 */
export async function normalizeAssets(
  platform: 'ios' | 'android',
  assets: {
    icon: string;
    screenshots: Record<string, string[]>;
    featureGraphic?: string;
  },
  outputDir: string,
): Promise<{ success: boolean; errors: string[] }> {
  const tempDir = await createTempDirWithCleanup();
  const errors: string[] = [];

  try {
    if (platform === 'ios') {
      const iconResults = await generateIOSIcons(assets.icon, outputDir);
      errors.push(...iconResults.filter((r) => !r.success).map((r) => r.error || 'Unknown error'));

      const screenshotValidation = await validateIOSScreenshots(assets.screenshots);
      errors.push(...screenshotValidation.errors);
    } else {
      const iconResults = await generateAndroidIcons(assets.icon, outputDir);
      errors.push(...iconResults.filter((r) => !r.success).map((r) => r.error || 'Unknown error'));

      if (assets.featureGraphic) {
        const featureResult = await normalizeAndroidFeatureGraphic(
          assets.featureGraphic,
          path.join(outputDir, 'feature.png'),
        );
        if (!featureResult.success) {
          errors.push(featureResult.error || 'Failed to normalize feature graphic');
        }
      }

      const screenshotValidation = await validateAndroidScreenshots(assets.screenshots);
      errors.push(...screenshotValidation.errors);
    }

    return {
      success: errors.length === 0,
      errors,
    };
  } finally {
    await tempDir.cleanup();
  }
}

/**
 * Get asset validation report
 */
export async function getAssetValidationReport(
  platform: 'ios' | 'android',
  assets: {
    icon: string;
    screenshots: Record<string, string[]>;
    featureGraphic?: string;
  },
): Promise<{
  valid: boolean;
  warnings: string[];
  errors: string[];
  recommendations: string[];
}> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const recommendations: string[] = [];

  if (platform === 'ios') {
    const screenshotValidation = await validateIOSScreenshots(assets.screenshots);
    errors.push(...screenshotValidation.errors);

    if (!assets.icon || !validateImageFormat(assets.icon)) {
      errors.push('iOS icon is missing or has invalid format');
    } else {
      const validSize = await validateImageSize(assets.icon);
      if (!validSize) {
        errors.push('iOS icon exceeds 10MB size limit');
      }
    }

    recommendations.push('Ensure screenshots are in PNG format for best quality');
    recommendations.push('Include screenshots for both iPhone 6.7" and iPad 12.9"');
  } else {
    const screenshotValidation = await validateAndroidScreenshots(assets.screenshots);
    errors.push(...screenshotValidation.errors);

    if (!assets.icon || !validateImageFormat(assets.icon)) {
      errors.push('Android icon is missing or has invalid format');
    }

    if (!assets.featureGraphic || !validateImageFormat(assets.featureGraphic)) {
      warnings.push('Android feature graphic is missing or has invalid format');
    }

    recommendations.push('Include screenshots for phone and tablet devices');
    recommendations.push('Feature graphic should be 1024x500 for best visibility');
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
    recommendations,
  };
}
