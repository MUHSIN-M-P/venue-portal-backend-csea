import { createServer } from "./createServer.js";
import { startEmailWorker, closeEmailWorker } from "./workers/email.worker.js";
import { emailQueue } from "./queues/email.queue.js";

const app = createServer();

const PORT = process.env.PORT || 3000;

// Start the BullMQ email worker
startEmailWorker();

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string) {
    console.log(`\n[shutdown] Received ${signal}. Shutting down gracefully…`);
    await closeEmailWorker();
    if (emailQueue) {
        await emailQueue.close();
    }
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));