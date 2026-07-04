import http from "node:http";
import { Worker, type ConnectionOptions, type Job } from "bullmq";
import { Redis } from "ioredis";
import { AI_QUEUE, JobType, type AiJobData } from "@synapse/shared";
import { config } from "./config.js";
import { getDocumentText, replaceEmbeddings, replaceAiTags, pool } from "./db.js";
import { chunkText, embed } from "./embeddings.js";
import { generateTags } from "./tagging.js";

const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

let jobsCompleted = 0;
let jobsFailed = 0;

async function handleEmbed(documentId: string): Promise<{ chunks: number }> {
  const text = await getDocumentText(documentId);
  if (!text) return { chunks: 0 };
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    await replaceEmbeddings(documentId, [], []);
    return { chunks: 0 };
  }
  const vectors = await embed(chunks);
  await replaceEmbeddings(documentId, chunks, vectors);
  return { chunks: chunks.length };
}

async function handleTag(documentId: string): Promise<{ tags: string[] }> {
  const text = await getDocumentText(documentId);
  if (!text) return { tags: [] };
  const tags = await generateTags(text);
  await replaceAiTags(documentId, tags);
  return { tags };
}

const worker = new Worker<AiJobData>(
  AI_QUEUE,
  async (job: Job<AiJobData>) => {
    switch (job.data.type) {
      case JobType.EMBED_DOCUMENT:
        return handleEmbed(job.data.documentId);
      case JobType.TAG_DOCUMENT:
        return handleTag(job.data.documentId);
      default:
        throw new Error(`Unknown job type: ${(job.data as { type: string }).type}`);
    }
  },
  {
    connection: connection as unknown as ConnectionOptions,
    concurrency: config.concurrency,
  },
);

worker.on("completed", (job) => {
  jobsCompleted++;
  console.log(`[worker] completed ${job.name} (${job.id})`);
});
worker.on("failed", (job, err) => {
  jobsFailed++;
  console.error(`[worker] failed ${job?.name} (${job?.id}):`, err.message);
});

const healthPort = Number(process.env.WORKER_HEALTH_PORT ?? 4002);
const healthServer = http.createServer(async (req, res) => {
  if (req.url === "/healthz") {
    const redisOk = connection.status === "ready";
    const status = redisOk ? "ok" : "degraded";
    const code = redisOk ? 200 : 503;
    res.writeHead(code, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        status,
        service: "worker",
        redis: connection.status,
        uptime: process.uptime(),
        jobs: { completed: jobsCompleted, failed: jobsFailed },
      }),
    );
    return;
  }
  if (req.url === "/metrics") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(
      [
        `# HELP worker_jobs_completed_total Total completed jobs`,
        `# TYPE worker_jobs_completed_total counter`,
        `worker_jobs_completed_total ${jobsCompleted}`,
        `# HELP worker_jobs_failed_total Total failed jobs`,
        `# TYPE worker_jobs_failed_total counter`,
        `worker_jobs_failed_total ${jobsFailed}`,
        `# HELP worker_uptime_seconds Worker process uptime`,
        `# TYPE worker_uptime_seconds gauge`,
        `worker_uptime_seconds ${process.uptime()}`,
      ].join("\n") + "\n",
    );
    return;
  }
  res.writeHead(404);
  res.end();
});
healthServer.listen(healthPort, () => {
  console.log(`[worker] health server on http://localhost:${healthPort}/healthz`);
});

console.log(`Synapse worker listening on queue "${AI_QUEUE}" (concurrency ${config.concurrency})`);

async function shutdown() {
  console.log("Shutting down worker...");
  healthServer.close();
  await worker.close();
  await connection.quit();
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
