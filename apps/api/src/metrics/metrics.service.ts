import { Injectable, OnModuleInit } from "@nestjs/common";
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Histogram,
  Gauge,
} from "prom-client";

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly httpRequestDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status"] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  readonly httpRequestsTotal = new Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status"] as const,
    registers: [this.registry],
  });

  readonly aiRequestsTotal = new Counter({
    name: "ai_requests_total",
    help: "Total AI feature invocations",
    labelNames: ["feature", "status"] as const,
    registers: [this.registry],
  });

  readonly aiRequestDuration = new Histogram({
    name: "ai_request_duration_seconds",
    help: "Duration of AI feature calls",
    labelNames: ["feature"] as const,
    buckets: [0.5, 1, 2, 5, 10, 30, 60],
    registers: [this.registry],
  });

  readonly wsActiveConnections = new Gauge({
    name: "ws_active_connections",
    help: "Current number of active WebSocket connections (reported by API)",
    registers: [this.registry],
  });

  readonly dbPoolActive = new Gauge({
    name: "db_pool_active_connections",
    help: "Number of active database pool connections",
    registers: [this.registry],
  });

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
