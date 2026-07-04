import { config as dotenvConfig } from "dotenv";
dotenvConfig();
dotenvConfig({ path: "../../.env" });

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  embeddingsProvider: process.env.EMBEDDINGS_PROVIDER ?? "gemini",
  embeddingsModel: process.env.EMBEDDINGS_MODEL ?? "gemini-embedding-001",
  embeddingsDim: Number(process.env.EMBEDDINGS_DIM ?? 768),
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 4),
};

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is required for the worker");
}
