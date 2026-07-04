import { Controller, Get, Res } from "@nestjs/common";
import { Response } from "express";
import { Public } from "../common/public.decorator";
import { MetricsService } from "./metrics.service";

@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get("metrics")
  async prometheus(@Res() res: Response) {
    const metricsText = await this.metrics.getMetrics();
    res.set("Content-Type", this.metrics.registry.contentType);
    res.end(metricsText);
  }
}
