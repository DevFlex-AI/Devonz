import { type ActionFunctionArgs, json } from '@remix-run/node';
import {
  submitIOS,
  submitAndroid,
  validateMetadata,
  normalizeAssetsForPlatform,
  runPreflight,
  type StoreMetadata,
  Platform,
  type SubmitIOSJobData,
  type SubmitAndroidJobData,
} from '~/lib/modules/publish';
import { hasFeature } from '~/lib/features';

/**
 * Start a publishing job
 */
export async function action({ request }: ActionFunctionArgs) {
  // Feature gate check
  if (!hasFeature('store_publish')) {
    return json({ error: 'Store publishing is not enabled' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { type, platform, data, options } = body;

    let jobId: string;

    switch (type) {
      case 'ios':
        jobId = submitIOS(data as SubmitIOSJobData, options);
        break;

      case 'android':
        jobId = submitAndroid(data as SubmitAndroidJobData, options);
        break;

      case 'validate':
        jobId = validateMetadata(data as StoreMetadata, options?.dryRun);
        break;

      case 'normalize':
        jobId = normalizeAssetsForPlatform(
          platform as Platform,
          data.assets,
          data.outputDir,
          options,
        );
        break;

      case 'preflight':
        jobId = runPreflight(data as StoreMetadata, platform as Platform, options?.dryRun);
        break;

      default:
        return json({ error: 'Invalid job type' }, { status: 400 });
    }

    return json({
      success: true,
      jobId,
      type,
      platform,
    });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}
