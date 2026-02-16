import { type ActionFunctionArgs, json } from '@remix-run/node';
import { cancelJob, hasFeature } from '~/lib/modules/publish';

/**
 * Cancel a publishing job
 */
export async function action({ request }: ActionFunctionArgs) {
  // Feature gate check
  if (!hasFeature('store_publish')) {
    return json({ error: 'Store publishing is not enabled' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return json({ error: 'Job ID is required' }, { status: 400 });
    }

    cancelJob(jobId);

    return json({
      success: true,
      message: 'Job cancelled successfully',
      jobId,
    });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}
