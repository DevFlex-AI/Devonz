# Mobile Publishing Examples

This directory contains example files and configurations for mobile publishing.

## Files

### `store.example.json`

Example `store.json` file containing all required metadata for both iOS (App Store Connect / TestFlight) and Android (Google Play Console) publishing.

Copy this file and customize it for your app:

```bash
cp store.example.json store.json
```

## Required Assets

### iOS Icons

- App icon: 1024x1024 PNG
- The system will automatically generate all required sizes from this

### iOS Screenshots

Required device types:
- iPhone 6.7" (3-10 screenshots)
- iPad 12.9" (3-10 screenshots)

Optional device types:
- iPhone 6.5" (3-10 screenshots)
- iPhone 5.5" (3-10 screenshots)
- iPad Pro 3rd Gen (3-10 screenshots)

### Android Icons

- App icon: 512x512 PNG
- The system will automatically generate all adaptive icon sizes from this

### Android Screenshots

Required device types:
- Phone (2-8 screenshots)

Optional device types:
- 7-inch tablet (2-8 screenshots)
- 10-inch tablet (2-8 screenshots)
- TV (optional)
- Wear (optional)

### Android Feature Graphic

- Feature graphic: 1024x500 PNG (required)

### Android Promo Graphic

- Promo graphic: 180x120 PNG (optional)

### Android TV Banner

- TV banner: 1280x720 PNG (optional)

## Directory Structure Example

```
assets/
├── icons/
│   ├── ios/
│   │   └── icon.png (1024x1024)
│   └── android/
│       └── icon.png (512x512)
└── screenshots/
    ├── ios/
    │   ├── iphone-1.png (1290x2796)
    │   ├── iphone-2.png
    │   ├── iphone-3.png
    │   ├── ipad-1.png (2048x2732)
    │   └── ipad-2.png
    └── android/
        ├── phone-1.png (1080x1920)
        ├── phone-2.png
        ├── 7in-1.png (1200x1920)
        ├── 10in-1.png (1920x2560)
        └── feature.png (1024x500)
```

## Validation

Before submitting, validate your `store.json`:

```bash
# Via API
curl -X POST http://localhost:5173/api/publish/validate \
  -H "Content-Type: application/json" \
  -d '{
    "type": "metadata",
    "data": $(cat store.json)
  }'

# Via code
import { validateMetadataSync } from '~/lib/modules/publish';

const result = await validateMetadataSync(require('./store.json'));
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

## Next Steps

1. Customize `store.example.json` with your app details
2. Prepare all required assets
3. Validate metadata and assets
4. Test with dry run mode (`PUBLISH_DRY_RUN=true`)
5. Submit to stores when ready

See [Publishing Documentation](../docs/publishing.md) for more details.
