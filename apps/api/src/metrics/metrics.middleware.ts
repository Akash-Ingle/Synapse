import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { MetricsService } from "./metrics.service";

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (req.path === "/metrics" || req.path === "/healthz") {
      return next();
    }

    const end = this.metrics.httpRequestDuration.startTimer();

    res.on("finish", () => {
      const route = this.normalizeRoute(req.route?.path ?? req.path);
      const labels = {
        method: req.method,
        route,
        status: String(res.statusCode),
      };

      end(labels);
      this.metrics.httpRequestsTotal.inc(labels);
    });

    next();
  }

  private normalizeRoute(path: string): string {
    return path
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        ":id",
      )
      .replace(/\/\d+/g, "/:num");
  }
}
