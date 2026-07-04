import { config as dotenvConfig } from "dotenv";
dotenvConfig();
dotenvConfig({ path: "../../.env" });

export const config = {
  port: Number(process.env.COLLAB_PORT ?? 4001),
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret",
  persistDebounceMs: Number(process.env.COLLAB_PERSIST_DEBOUNCE_MS ?? 2000),
};

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is required for the collab service");
}
