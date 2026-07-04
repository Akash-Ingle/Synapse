import { config as dotenvConfig } from "dotenv";
// Load .env from wherever it exists — monorepo root or local.
dotenvConfig();
dotenvConfig({ path: "../../.env" });

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { loadConfig } from "./config/configuration";

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix("api");
  app.enableCors({ origin: true, credentials: true });
  app.enableShutdownHooks();

  await app.listen(config.API_PORT);
  const logger = app.get(Logger);
  logger.log(`Synapse API listening on http://localhost:${config.API_PORT}/api`);
}

bootstrap();
