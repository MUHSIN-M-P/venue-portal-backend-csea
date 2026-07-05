import { Queue } from 'bullmq';
import type { SendEmailPayload } from '../services/email.service.js';

// ---------------------------------------------------------------------------
// Redis connection
// ---------------------------------------------------------------------------

const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

/**
 * Parse the REDIS_URL into a connection config object.
 * BullMQ accepts a plain { host, port, password, … } object
 * so we don't need to construct an IORedis instance ourselves.
 */
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || '127.0.0.1',
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    maxRetriesPerRequest: null as null, // required by BullMQ
  };
}

const isRedisDisabled = process.env.DISABLE_REDIS === 'true';

export const redisConnection = isRedisDisabled ? null as any : parseRedisUrl(REDIS_URL);

// ---------------------------------------------------------------------------
// Queue instance
// ---------------------------------------------------------------------------

export const EMAIL_QUEUE_NAME = 'email';

export const emailQueue = isRedisDisabled
  ? null as any
  : new Queue(EMAIL_QUEUE_NAME, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2_000, // 2 s → 4 s → 8 s
        },
        removeOnComplete: { count: 200 },  // keep last 200 completed jobs
        removeOnFail: { count: 500 },      // keep last 500 failed jobs
      },
    });

// ---------------------------------------------------------------------------
// Helper — add an email job to the queue
// ---------------------------------------------------------------------------

export interface EmailJobResult {
  queued: true;
  jobId: string;
}

/**
 * Enqueue an email-sending job.
 *
 * @param name   A human-readable job name (e.g. `booking-submitted`)
 * @param payload  The same `SendEmailPayload` that `sendEmail()` accepts
 */
export async function addEmailJob(
  name: string,
  payload: SendEmailPayload,
): Promise<EmailJobResult> {
  // const job = await emailQueue.add(name, payload);
  // console.log(`[email-queue] Job "${name}" enqueued — id: ${job.id}`);
  // return { queued: true, jobId: job.id! };
  console.log(`[email-queue] Suppressed job "${name}" (email notifications temporarily disabled)`);
  return { queued: true, jobId: 'mock-job-id' };
}
