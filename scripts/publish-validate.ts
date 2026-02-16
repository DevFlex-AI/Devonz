#!/usr/bin/env node

/**
 * Script to validate store.json and check publishing configuration
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateMetadataSync, runPreflightSync, validateAssetsSync, getCredentialStatus, isDryRunMode } from '../app/lib/modules/publish';
import type { StoreMetadata } from '../app/lib/modules/publish';

const args = process.argv.slice(2);
const command = args[0] || 'validate';

async function main() {
  console.log('📱 Mobile Publishing Validator\n');

  switch (command) {
    case 'validate': {
      const filePath = resolve(process.cwd(), args[1] || 'store.json');
      console.log(`Validating ${filePath}...\n`);

      try {
        const content = readFileSync(filePath, 'utf-8');
        const metadata = JSON.parse(content) as StoreMetadata;

        const result = await validateMetadataSync(metadata);

        if (result.valid) {
          console.log('✅ Schema validation passed!\n');
        } else {
          console.log('❌ Schema validation failed:\n');
          result.errors.forEach((error) => console.log(`  - ${error}\n`));
          process.exit(1);
        }

        if (result.warnings.length > 0) {
          console.log('⚠️  Warnings:\n');
          result.warnings.forEach((warning) => console.log(`  - ${warning}\n`));
        }
      } catch (error: any) {
        console.error(`❌ Failed to read or parse store.json: ${error.message}\n`);
        process.exit(1);
      }
      break;
    }

    case 'preflight': {
      const filePath = resolve(process.cwd(), args[1] || 'store.json');
      console.log(`Running preflight checks for ${filePath}...\n`);

      try {
        const content = readFileSync(filePath, 'utf-8');
        const metadata = JSON.parse(content) as StoreMetadata;

        const result = await runPreflightSync(metadata, true); // Always dry run

        if (result.valid) {
          console.log('✅ Preflight checks passed!\n');
        } else {
          console.log('❌ Preflight checks failed:\n');
          result.errors.forEach((error) => console.log(`  - ${error}\n`));
          process.exit(1);
        }

        if (result.warnings.length > 0) {
          console.log('⚠️  Warnings:\n');
          result.warnings.forEach((warning) => console.log(`  - ${warning}\n`));
        }
      } catch (error: any) {
        console.error(`❌ Failed to run preflight checks: ${error.message}\n`);
        process.exit(1);
      }
      break;
    }

    case 'assets': {
      const platform = args[1];
      const assetsDir = args[2] || './assets';

      if (!platform || !['ios', 'android'].includes(platform)) {
        console.error('❌ Invalid platform. Use: ios or android\n');
        process.exit(1);
      }

      console.log(`Validating assets for ${platform} in ${assetsDir}...\n`);

      // Mock assets object for validation
      const assets = {
        icon: `${assetsDir}/icons/${platform}/icon.png`,
        screenshots: {
          phone: [`${assetsDir}/screenshots/${platform}/phone-1.png`],
        },
        featureGraphic: platform === 'android' ? `${assetsDir}/screenshots/${platform}/feature.png` : undefined,
      };

      const result = await validateAssetsSync(platform as any, assets);

      if (result.valid) {
        console.log('✅ Asset validation passed!\n');
      } else {
        console.log('❌ Asset validation failed:\n');
        result.errors.forEach((error) => console.log(`  - ${error}\n`));
        process.exit(1);
      }

      if (result.warnings.length > 0) {
        console.log('⚠️  Warnings:\n');
        result.warnings.forEach((warning) => console.log(`  - ${warning}\n`));
      }
      break;
    }

    case 'config': {
      console.log('Checking configuration...\n');
      const credentials = getCredentialStatus();
      const dryRun = isDryRunMode();

      console.log('Credentials:');
      console.log(`  iOS: ${credentials.ios.configured ? '✅' : '❌'} Configured`);
      console.log(`  Android: ${credentials.android.configured ? '✅' : '❌'} Configured`);
      console.log(`  Android Signing: ${credentials.androidSigning.configured ? '✅' : '⚠️'} Configured`);
      console.log(`  EAS: ${credentials.eas.configured ? '✅' : '⚠️'} Configured`);

      console.log(`\nDry Run Mode: ${dryRun ? '✅ Enabled (safe)' : '⚠️  Disabled (real submissions)'}\n`);

      break;
    }

    case 'help': {
      console.log(`
Usage: npm run publish:validate <command> [options]

Commands:
  validate [path]          Validate store.json schema (default: ./store.json)
  preflight [path]         Run all preflight checks (default: ./store.json)
  assets <platform> [dir]  Validate assets for platform (ios/android, default: ./assets)
  config                   Check configuration and credentials
  help                      Show this help message

Examples:
  npm run publish:validate validate
  npm run publish:validate validate ./examples/store.example.json
  npm run publish:validate preflight
  npm run publish:validate assets ios
  npm run publish:validate config
      `);
      break;
    }

    default: {
      console.error(`❌ Unknown command: ${command}\n`);
      console.log('Run "npm run publish:validate help" for usage information.\n');
      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
