# Mobile Publishing Orchestrator

Production-ready, secure, CI-friendly mobile publishing system for iOS (App Store Connect / TestFlight / App Store) and Android (Google Play Console).

## Features

- **Multi-Platform Support**: iOS (App Store Connect API & Fastlane) and Android (Play Developer API & Fastlane)
- **Multiple Adapters**: Direct APIs, Fastlane, and Expo EAS Submit
- **Secret Management**: Secure base64-encoded credentials with automatic redaction
- **Asset Normalization**: Icons and screenshots for all device sizes
- **Dry Run Mode**: Test everything without real submissions
- **Job Queue**: Asynchronous processing with retries and backoff
- **Progress Tracking**: Real-time status updates and detailed logs
- **Feature Gates**: Control availability based on billing/identity

## Architecture

```
app/lib/modules/publish/
├── metadata/          # Schema validation and preflight checks
│   ├── schema.ts      # Zod schemas for store.json
│   ├── validator.ts   # Deep validation (versioning, assets, locales)
│   └── index.ts
├── assets/            # Asset normalization and validation
│   ├── normalizer.ts   # Icons, screenshots, feature graphics
│   └── index.ts
├── secrets/           # Secure secret management
│   ├── vault.ts       # Base64 decode, redaction, env access
│   └── index.ts
├── adapters/          # Platform-specific adapters
│   ├── ios-direct.ts  # App Store Connect API
│   ├── ios-fastlane.ts # Fastlane deliver/pilot
│   ├── ios-eas.ts    # Expo EAS Submit for iOS
│   ├── android-direct.ts # Play Developer API
│   ├── android-fastlane.ts # Fastlane supply
│   ├── android-eas.ts # Expo EAS Submit for Android
│   └── index.ts
├── queue/             # Job queue and worker
│   ├── jobs.ts        # Job definitions and types
│   ├── worker.ts      # In-memory queue processor
│   └── index.ts
├── status/            # Job status and reporting
│   ├── reporter.ts    # Job tracking, progress, logs
│   └── index.ts
├── util/              # Utilities
│   ├── logging.ts     # Logging with redaction
│   ├── fsSafe.ts      # Safe file operations
│   ├── tmp.ts         # Temporary directory management
│   ├── versioning.ts  # Version parsing and comparison
│   └── index.ts
└── index.ts           # Public API façade
```

## Getting Started

### 1. Configure Environment Variables

Add these to your `.env.local`:

```bash
# Enable mobile features
MOBILE_FEATURES=*

# App Store Connect
ASC_ISSUER_ID=YOUR_ISSUER_ID
ASC_KEY_ID=YOUR_KEY_ID
ASC_PRIVATE_KEY_B64=$(base64 -i AuthKey_YOUR_KEY_ID.p8)

# Google Play
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_B64=$(base64 -i service-account.json)

# Android Signing (optional for metadata-only)
ANDROID_KEYSTORE_B64=$(base64 -i upload-keystore.jks)
ANDROID_KEY_ALIAS=upload
ANDROID_KEYSTORE_PASSWORD=your_password
ANDROID_KEY_PASSWORD=your_password

# Dry run mode (safe default)
PUBLISH_DRY_RUN=true
```

### 2. Create `store.json`

Create a store metadata file:

```json
{
  "ios": {
    "bundleId": "com.company.app",
    "version": "1.0.0",
    "buildNumber": "1",
    "releaseType": "testflight-internal",
    "releaseNotes": "Initial release",
    "exportCompliance": {
      "usesEncryption": false,
      "isExempt": true
    },
    "reviewInformation": {
      "contactFirstName": "John",
      "contactLastName": "Doe",
      "contactEmail": "john@example.com",
      "contactPhone": "+1234567890"
    },
    "appInformation": {
      "description": "App description",
      "keywords": ["productivity", "utility"],
      "privacyPolicyUrl": "https://example.com/privacy",
      "supportUrl": "https://example.com/support"
    },
    "screenshots": {
      "iphone67": ["path/to/1.png", "path/to/2.png", "path/to/3.png"],
      "ipad129": ["path/to/ipad-1.png", "path/to/ipad-2.png", "path/to/ipad-3.png"]
    },
    "appIcon": "path/to/icon.png",
    "ageRating": "4+",
    "signInRequired": false
  },
  "android": {
    "packageName": "com.company.app",
    "versionName": "1.0.0",
    "versionCode": 1,
    "track": "internal",
    "userFraction": 0.1,
    "changelogs": {
      "en-US": "Initial release"
    },
    "listing": {
      "title": "My App",
      "shortDescription": "Description padded to 80 chars...",
      "fullDescription": "Full app description",
      "privacyPolicyUrl": "https://example.com/privacy"
    },
    "graphics": {
      "icon": "path/to/icon.png",
      "featureGraphic": "path/to/feature.png"
    },
    "screenshots": {
      "phone": ["path/to/1.png", "path/to/2.png"]
    },
    "contentRating": {
      "category": "GENERAL",
      "alcoholTobacco": "NONE"
    },
    "dataSafety": {
      "collectsData": false,
      "collectedData": []
    }
  }
}
```

### 3. Validate Metadata

```typescript
import { validateMetadataSync } from '~/lib/modules/publish';

const result = await validateMetadataSync(storeMetadata);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

### 4. Submit to Stores

#### iOS TestFlight (Internal)

```typescript
import { submitIOS } from '~/lib/modules/publish';

const jobId = submitIOS(
  {
    bundleId: 'com.company.app',
    version: '1.0.0',
    buildNumber: '1',
    releaseType: 'testflight-internal',
    releaseNotes: 'Initial release',
    buildPath: '/path/to/app.ipa',
    metadata: storeMetadata,
  },
  { dryRun: true } // Set to false for real submission
);
```

#### Android Internal Track

```typescript
import { submitAndroid } from '~/lib/modules/publish';

const jobId = submitAndroid(
  {
    packageName: 'com.company.app',
    versionName: '1.0.0',
    versionCode: 1,
    track: 'internal',
    buildPath: '/path/to/app.aab',
    metadata: storeMetadata,
  },
  { dryRun: true }
);
```

## API Endpoints

### Start Job

**POST** `/api/publish/start`

```json
{
  "type": "ios" | "android" | "validate" | "normalize" | "preflight",
  "platform": "ios" | "android" | "both",
  "data": { ... },
  "options": {
    "dryRun": true,
    "priority": 1
  }
}
```

**Response:**

```json
{
  "success": true,
  "jobId": "uuid",
  "type": "ios",
  "platform": "ios"
}
```

### Get Job Status

**GET** `/api/publish/status?jobId=xxx`

**Response:**

```json
{
  "success": true,
  "job": {
    "id": "uuid",
    "platform": "ios",
    "status": "RUNNING",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "startedAt": "2024-01-01T00:00:01.000Z",
    "completedAt": null,
    "dryRun": true,
    "progressPercentage": 45,
    "result": null,
    "progress": [...]
  }
}
```

### List Jobs

**GET** `/api/publish/status?list=true`

### Cancel Job

**POST** `/api/publish/cancel`

```json
{
  "jobId": "uuid"
}
```

### Validate Metadata (Sync)

**POST** `/api/publish/validate`

```json
{
  "type": "metadata" | "preflight" | "assets",
  "data": { ... },
  "dryRun": true
}
```

### Get Configuration Status

**GET** `/api/publish/config`

## Progress Codes

The publishing system emits progress events with stable codes:

- `JOB_STARTED`, `JOB_COMPLETED`, `JOB_FAILED`, `JOB_CANCELLED`
- `IOS_UPLOAD_START`, `IOS_UPLOAD_COMPLETE`, `IOS_BUILD_PROCESSING`, `IOS_BUILD_PROCESSED`
- `IOS_VERSION_SUBMITTED`, `IOS_REVIEW_PENDING`, `IOS_REVIEW_APPROVED`
- `ANDROID_UPLOAD_START`, `ANDROID_UPLOAD_COMPLETE`
- `ANDROID_EDIT_CREATED`, `ANDROID_TRACK_ASSIGNED`, `ANDROID_EDIT_COMMITTED`
- `ANDROID_ROLLOUT_STARTED`, `ANDROID_ROLLOUT_EXPANDED`, `ANDROID_ROLLOUT_HALTED`
- `ASSET_NORMALIZATION_START`, `ASSET_NORMALIZATION_COMPLETE`

## Troubleshooting

### Version Conflicts

**Error**: `iOS buildNumber must increase. Last build number was 5, new is 5`

**Solution**: Increment build number in `store.json` or use auto-suggestion.

### Missing Assets

**Error**: `iOS iphone67 requires at least 3 screenshots`

**Solution**: Add required screenshots to your `store.json`:
- iOS: iPhone 6.7" (3-10), iPad 12.9" (3-10)
- Android: Phone (2-8), 7" tablet (2-8, optional), 10" tablet (2-8, optional)

### Credentials Not Configured

**Error**: `App Store Connect credentials not configured`

**Solution**:
1. iOS: Ensure `ASC_ISSUER_ID`, `ASC_KEY_ID`, `ASC_PRIVATE_KEY_B64` are set
2. Android: Ensure `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_B64` is set

### Build Processing Timeout

**Error**: `Build processing timed out`

**Solution**:
- Check App Store Connect / Play Console for manual approval
- Ensure build is valid (no signing issues)
- Wait longer or increase timeout in worker configuration

### Export Compliance

**Warning**: `App uses encryption and is not exempt`

**Solution**: Update export compliance in `store.json`:
```json
{
  "exportCompliance": {
    "usesEncryption": true,
    "isExempt": false
  }
}
```

## Security Best Practices

1. **Never Commit Secrets**: Use environment variables only
2. **Base64 Encode**: Encode keys before adding to `.env`
3. **Dry Run First**: Always test with `PUBLISH_DRY_RUN=true`
4. **Rotate Keys**: Regularly rotate API keys and certificates
5. **Least Privilege**: Use service accounts with minimal required permissions
6. **Log Redaction**: All secrets are automatically redacted in logs

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Mobile Publish

on:
  workflow_dispatch:
    inputs:
      platform:
        type: choice
        options: [ios, android, both]
      dry_run:
        type: boolean
        default: true

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run publish:validate

  submit:
    if: ${{ github.event.inputs.platform != 'none' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci

      - name: Submit to Store
        run: node scripts/submit.js
        env:
          ASC_ISSUER_ID: ${{ secrets.ASC_ISSUER_ID }}
          ASC_KEY_ID: ${{ secrets.ASC_KEY_ID }}
          ASC_PRIVATE_KEY_B64: ${{ secrets.ASC_PRIVATE_KEY_B64 }}
          GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_B64: ${{ secrets.GP_SA_JSON_B64 }}
          PUBLISH_DRY_RUN: ${{ github.event.inputs.dry_run }}
```

## Rollback & Staged Rollout

### Android Staged Rollout

```typescript
// Start with 10% rollout
const jobId = submitAndroid({
  packageName: 'com.company.app',
  versionCode: 42,
  track: 'production',
  userFraction: 0.1,
});
```

### Expand Rollout

```typescript
// Expand to 50%
await playClient.expandRollout('com.company.app', 'production', 0.5);
```

### Halt Rollout

```typescript
// Halt if issues found
await playClient.haltRollout('com.company.app', 'production');
```

### Rollback

```typescript
// Revert to previous version
await playClient.rollbackToPrevious('com.company.app', 'production');
```

## Testing Locally

### Dry Run Mode

```bash
PUBLISH_DRY_RUN=true npm run dev
```

### Validate Store.json

```bash
curl -X POST http://localhost:5173/api/publish/validate \
  -H "Content-Type: application/json" \
  -d '{
    "type": "metadata",
    "data": { ...store.json content... }
  }'
```

### Check Configuration

```bash
curl http://localhost:5173/api/publish/config
```

## License

MIT
