import { type ActionFunctionArgs, json } from '@remix-run/node';
import {
  validateMetadataSync,
  runPreflightSync,
  validateAssetsSync,
  Platform,
  hasFeature,
} from '~/lib/modules/publish';

/**
 * Validate metadata or assets synchronously
 */
export async function action({ request }: ActionFunctionArgs) {
  // Feature gate check
  if (!hasFeature('store_publish')) {
    return json({ error: 'Store publishing is not enabled' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { type, platform, data, dryRun } = body;

    switch (type) {
      case 'metadata': {
        const result = await validateMetadataSync(data);
        return json({ success: true, type, result });
      }

      case 'preflight': {
        const result = await runPreflightSync(data, dryRun);
        return json({ success: true, type, result });
      }

      case 'assets': {
        const result = await validateAssetsSync(platform as Platform, data);
        return json({ success: true, type, platform, result });
      }

      default:
        return json({ error: 'Invalid validation type' }, { status: 400 });
    }
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}
