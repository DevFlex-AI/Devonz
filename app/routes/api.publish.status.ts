import { type LoaderFunctionArgs, json } from '@remix-run/node';
import {
  getJobStatus,
  getJobSummary,
  getJobProgress,
  exportJobLogs,
  getJobStatistics,
  getQueueStatistics,
  listJobs,
  hasFeature,
} from '~/lib/modules/publish';

/**
 * Get job status
 * GET /api/publish/status?jobId=xxx
 * GET /api/publish/status?list=true (list all jobs)
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // Feature gate check
  if (!hasFeature('store_publish')) {
    return json({ error: 'Store publishing is not enabled' }, { status: 403 });
  }

  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId');
  const list = url.searchParams.get('list');
  const summary = url.searchParams.get('summary');
  const logs = url.searchParams.get('logs');

  // List all jobs
  if (list === 'true') {
    const jobs = listJobs();
    return json({
      success: true,
      jobs: jobs.map((job) => ({
        id: job.id,
        platform: job.platform,
        status: job.status,
        createdAt: job.createdAt,
        dryRun: job.dryRun,
        result: job.result,
      })),
    });
  }

  // Get job statistics
  if (summary === 'statistics') {
    return json({
      success: true,
      jobStats: getJobStatistics(),
      queueStats: getQueueStatistics(),
    });
  }

  if (!jobId) {
    return json({ error: 'Job ID is required' }, { status: 400 });
  }

  const job = getJobStatus(jobId);

  if (!job) {
    return json({ error: 'Job not found' }, { status: 404 });
  }

  // Get job summary only
  if (summary === 'true') {
    const summary = getJobSummary(jobId);
    return json({
      success: true,
      summary,
    });
  }

  // Export job logs
  if (logs === 'true') {
    const logsText = exportJobLogs(jobId);
    return new Response(logsText, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': `attachment; filename="job-${jobId}-logs.txt"`,
      },
    });
  }

  // Get full job status
  const progress = getJobProgress(jobId);

  return json({
    success: true,
    job: {
      id: job.id,
      platform: job.platform,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      dryRun: job.dryRun,
      progressPercentage: progress,
      result: job.result,
      progress: job.progress,
    },
  });
}
