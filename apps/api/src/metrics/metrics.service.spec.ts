import { MetricsService } from "./metrics.service";

describe("MetricsService", () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
    service.onModuleInit();
  });

  it("should expose a Prometheus registry", () => {
    expect(service.registry).toBeDefined();
  });

  it("should return Prometheus-formatted metrics string", async () => {
    const output = await service.getMetrics();

    expect(typeof output).toBe("string");
    expect(output).toContain("http_request_duration_seconds");
    expect(output).toContain("http_requests_total");
    expect(output).toContain("ai_requests_total");
    expect(output).toContain("process_cpu_seconds_total");
  });

  it("should increment http request counter", async () => {
    service.httpRequestsTotal.inc({ method: "GET", route: "/test", status: "200" });

    const output = await service.getMetrics();
    expect(output).toContain('http_requests_total{method="GET",route="/test",status="200"} 1');
  });

  it("should record AI request duration", async () => {
    const end = service.aiRequestDuration.startTimer({ feature: "rewrite" });
    end();

    const output = await service.getMetrics();
    expect(output).toContain("ai_request_duration_seconds");
  });

  it("should increment AI request counter", async () => {
    service.aiRequestsTotal.inc({ feature: "summarize", status: "success" });

    const output = await service.getMetrics();
    expect(output).toContain('ai_requests_total{feature="summarize",status="success"} 1');
  });
});
