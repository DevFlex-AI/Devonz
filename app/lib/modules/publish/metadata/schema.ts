import { z } from 'zod';

// iOS Export Compliance Schema
const exportComplianceSchema = z.object({
  usesEncryption: z.boolean(),
  isExempt: z.boolean(),
  encryptionAlgorithms: z.array(z.string()).optional(),
  hasThirdPartyEncryption: z.boolean().optional(),
});

// iOS Review Information Schema
const reviewInformationSchema = z.object({
  contactFirstName: z.string().min(1, 'Contact first name is required'),
  contactLastName: z.string().min(1, 'Contact last name is required'),
  contactEmail: z.string().email('Invalid contact email'),
  contactPhone: z.string().min(10, 'Contact phone is required'),
  demoUser: z.string().optional(),
  demoPassword: z.string().optional(),
  notes: z.string().optional(),
});

// iOS App Information Schema
const appInformationSchema = z.object({
  subtitle: z.string().max(30).optional(),
  promotionalText: z.string().max(170).optional(),
  description: z.string().min(10, 'Description is required and must be at least 10 characters'),
  keywords: z.array(z.string()).min(1, 'At least one keyword is required').max(100),
  privacyPolicyUrl: z.string().url('Invalid privacy policy URL'),
  supportUrl: z.string().url('Invalid support URL'),
  marketingUrl: z.string().url().optional(),
});

// iOS Screenshots Schema
const iosScreenshotsSchema = z.object({
  iphone67: z.array(z.string()).min(3, 'iPhone 6.7" requires at least 3 screenshots').max(10),
  iphone65: z.array(z.string()).min(3, 'iPhone 6.5" requires at least 3 screenshots').max(10).optional(),
  iphone55: z.array(z.string()).min(3, 'iPhone 5.5" requires at least 3 screenshots').max(10).optional(),
  ipad129: z.array(z.string()).min(3, 'iPad 12.9" requires at least 3 screenshots').max(10),
  ipadPro3Gen: z.array(z.string()).min(3, 'iPad Pro 3rd Gen requires at least 3 screenshots').max(10).optional(),
});

// iOS Platform Schema
const iosSchema = z.object({
  bundleId: z.string().regex(/^[a-z0-9]+(\.[a-z0-9]+)+$/, 'Invalid bundle ID format'),
  version: z.string().regex(/^\d+\.\d+(\.\d+)?$/, 'Version must be in format X.Y or X.Y.Z'),
  buildNumber: z.string().regex(/^\d+$/, 'Build number must be a positive integer'),
  releaseType: z.enum(['testflight-internal', 'testflight-external', 'appStore']),
  releaseNotes: z.string().min(1, 'Release notes are required'),
  exportCompliance: exportComplianceSchema,
  reviewInformation: reviewInformationSchema,
  appInformation: appInformationSchema,
  screenshots: iosScreenshotsSchema,
  appIcon: z.string().min(1, 'App icon path is required'),
  ageRating: z.enum(['4+', '9+', '12+', '17+']),
  signInRequired: z.boolean(),
});

// Android Content Rating Data Schema
const contentRatingDataSchema = z.object({
  type: z.enum(['Location', 'Contacts', 'Messages', 'Email', 'Calendar', 'Other']),
  purpose: z.array(z.string()),
  optional: z.boolean().optional(),
});

// Android Content Rating Schema
const contentRatingSchema = z.object({
  category: z.enum(['GENERAL', 'PRE_TEEN', 'TEEN', 'MATURE']),
  alcoholTobacco: z.enum(['NONE', 'UNDECIDED', 'FREQUENT', 'GRAPHIC']),
  drugs: z.enum(['NONE', 'UNDECIDED', 'FREQUENT', 'GRAPHIC']),
  gambling: z.enum(['NONE', 'UNDECIDED', 'SIMULATED', 'REAL_MONEY']),
});

// Android Data Safety Schema
const dataSafetySchema = z.object({
  collectsData: z.boolean(),
  sharedData: z.array(contentRatingDataSchema).optional(),
  collectedData: z.array(contentRatingDataSchema),
});

// Android Graphics Schema
const androidGraphicsSchema = z.object({
  icon: z.string().min(1, 'App icon path is required'),
  featureGraphic: z.string().min(1, 'Feature graphic path is required'),
  promoGraphic: z.string().optional(),
  tvBanner: z.string().optional(),
});

// Android Screenshots Schema
const androidScreenshotsSchema = z.object({
  phone: z.array(z.string()).min(2, 'Phone screenshots require at least 2 images').max(8),
  sevenInch: z.array(z.string()).min(2, '7-inch screenshots require at least 2 images').max(8).optional(),
  tenInch: z.array(z.string()).min(2, '10-inch screenshots require at least 2 images').max(8).optional(),
  tv: z.array(z.string()).optional(),
  wear: z.array(z.string()).optional(),
});

// Android Listing Schema
const androidListingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(30),
  shortDescription: z.string().min(80, 'Short description must be at least 80 characters').max(80),
  fullDescription: z.string().min(1, 'Full description is required').max(4000),
  privacyPolicyUrl: z.string().url('Invalid privacy policy URL'),
  videoUrl: z.string().url().optional(),
});

// Android Platform Schema
const androidSchema = z.object({
  packageName: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, 'Invalid package name format'),
  versionName: z.string().regex(/^\d+\.\d+(\.\d+)?$/, 'Version name must be in format X.Y or X.Y.Z'),
  versionCode: z.number().int().positive('Version code must be a positive integer'),
  track: z.enum(['internal', 'alpha', 'beta', 'production']),
  userFraction: z.number().min(0).max(1).optional(),
  changelogs: z.record(z.string().min(1, 'Changelog is required')),
  listing: androidListingSchema,
  graphics: androidGraphicsSchema,
  screenshots: androidScreenshotsSchema,
  contentRating: contentRatingSchema,
  dataSafety: dataSafetySchema,
});

// Main Store Schema
const storeSchema = z.object({
  ios: iosSchema,
  android: androidSchema,
});

export type StoreMetadata = z.infer<typeof storeSchema>;
export type IOSMetadata = z.infer<typeof iosSchema>;
export type AndroidMetadata = z.infer<typeof androidSchema>;

export { storeSchema, iosSchema, androidSchema };
