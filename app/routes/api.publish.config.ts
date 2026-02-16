import { type LoaderFunctionArgs, json } from '@remix-run/node';
import {
  getCredentialStatus,
  validateSecrets,
  isDryRunMode,
  getSampleStoreMetadata,
  hasFeature,
} from '~/lib/modules/publish';
import { getEnabledFeatures } from '~/lib/features';

/**
 * Get publishing configuration status
 */
export async function loader({ request }: ActionFunctionArgs) {
  // Feature gate check
  if (!hasFeature('store_publish')) {
    return json({
      enabled: false,
      message: 'Store publishing is not enabled',
    });
  }

  const credentials = getCredentialStatus();
  const secrets = validateSecrets();
  const dryRun = isDryRunMode();
  const features = getEnabledFeatures();

  return json({
    enabled: true,
    credentials,
    secrets,
    dryRun,
    features,
    sampleMetadata: getSampleStoreMetadata(),
  });
}
