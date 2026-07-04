import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { PrismaService } from "../prisma/prisma.service";
import { APP_CONFIG } from "../config/config.module";

const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("HealthController", () => {
  let controller: HealthController;
  let prisma: jest.Mocked<any>;
  let module: TestingModule;

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
    };

    module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        {
          provide: APP_CONFIG,
          useValue: { REDIS_URL: "redis://localhost:6379" },
        },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  afterEach(async () => {
    await module.close();
  });

  describe("liveness", () => {
    it("should return ok with uptime and timestamp", () => {
      const result = controller.liveness();

      expect(result.status).toBe("ok");
      expect(result.service).toBe("api");
      expect(result.uptime).toBeDefined();
      expect(result.ts).toBeDefined();
    });
  });

  describe("readiness", () => {
    it("should return 200 when DB is up", async () => {
      prisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
      const res = mockResponse();

      await controller.readiness(res);

      expect(res.status).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          checks: expect.objectContaining({ db: "up" }),
        }),
      );
    });

    it("should return 503 when DB is down", async () => {
      prisma.$queryRaw.mockRejectedValue(new Error("connection refused"));
      const res = mockResponse();

      await controller.readiness(res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "not-ready",
          checks: expect.objectContaining({ db: "down" }),
        }),
      );
    });
  });
});
