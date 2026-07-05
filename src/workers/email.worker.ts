import { Worker, Job } from 'bullmq';
import { redisConnection, EMAIL_QUEUE_NAME } from '../queues/email.queue.js';
import { sendEmail, type SendEmailPayload } from '../services/email.service.js';

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

let worker: Worker | null = null;

const CONCURRENCY = parseInt(process.env.EMAIL_QUEUE_CONCURRENCY ?? '3', 10);

/**
 * Start the BullMQ email worker.
 * Call once at app startup (e.g. in index.ts).
 */
export function startEmailWorker(): void {
  if (process.env.DISABLE_REDIS === 'true') {
    console.log('[email-worker] Redis is disabled. Email worker is skipped.');
    return;
  }

  if (worker) {
    console.warn('[email-worker] Worker is already running.');
    return;
  }

  worker = new Worker<SendEmailPayload>(
    EMAIL_QUEUE_NAME,
    async (job: Job<SendEmailPayload>) => {
      console.log(
        `[email-worker] Processing job ${job.id} (${job.name}) — attempt ${job.attemptsMade + 1}`,
      );

      const result = await sendEmail(job.data);

      if (!result.success) {
        // Throw so BullMQ treats it as a failure and retries
        throw new Error('error' in result ? result.error : 'Unknown email error');
      }

      return result;
    },
    {
      connection: redisConnection,
      concurrency: CONCURRENCY,
    },
  );

  // --- Event listeners for observability ---

  worker.on('completed', (job) => {
    console.log(`[email-worker] ✅ Job ${job.id} (${job.name}) completed.`);
  });

  worker.on('failed', (job, err) => {
    console.error(
      `[email-worker] ❌ Job ${job?.id} (${job?.name}) failed: ${err.message}`,
    );
  });

  worker.on('error', (err) => {
    console.error('[email-worker] Worker error:', err.message);
  });

  console.log(
    `[email-worker] Worker started — queue: "${EMAIL_QUEUE_NAME}", concurrency: ${CONCURRENCY}`,
  );
}

/**
 * Gracefully close the worker (drain current jobs, then disconnect).
 */
export async function closeEmailWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('[email-worker] Worker shut down gracefully.');
  }
}
