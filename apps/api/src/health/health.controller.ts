import {
  Controller,
  Get,
  HttpStatus,
  Inject,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import IORedis from "ioredis";
import { Public } from "../common/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { APP_CONFIG } from "../config/config.module";
import type { AppConfig } from "../config/configuration";

@Controller()
export class HealthController {
  private readonly redis: IORedis;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.redis = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      lazyConnect: true,
    });
  }

  @Public()
  @Get("healthz")
  liveness() {
    return {
      status: "ok",
      service: "api",
      uptime: process.uptime(),
      ts: new Date().toISOString(),
    };
  }

  @Public()
  @Get("readyz")
  async readiness(@Res() res: Response) {
    const checks: Record<string, "up" | "down"> = { db: "down", redis: "down" };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.db = "up";
    } catch {}

    try {
      await this.redis.ping();
      checks.redis = "up";
    } catch {}

    const allUp = Object.values(checks).every((v) => v === "up");
    const status = allUp ? "ready" : "not-ready";
    const code = allUp ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    res.status(code).json({ status, checks });
  }
}
