import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { APP_CONFIG } from "../config/config.module";

const mockConfig = {
  JWT_ACCESS_SECRET: "test-access-secret",
  JWT_REFRESH_SECRET: "test-refresh-secret",
  JWT_ACCESS_TTL: 900,
  JWT_REFRESH_TTL: 604800,
  REDIS_URL: "redis://localhost:6379",
};

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  passwordHash: "$2a$12$hashedpassword",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("AuthService", () => {
  let service: AuthService;
  let prisma: jest.Mocked<any>;
  let jwt: jest.Mocked<JwtService>;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      workspace: { create: jest.fn() },
      refreshToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue("mock-token"),
            verifyAsync: jest.fn(),
          },
        },
        { provide: APP_CONFIG, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(AuthService);
    jwt = module.get(JwtService);
  });

  describe("register", () => {
    it("should create user, workspace, and return tokens", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      prisma.workspace.create.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register({
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      });

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: "test@example.com" }),
        }),
      );
      expect(prisma.workspace.create).toHaveBeenCalled();
    });

    it("should throw ConflictException if email exists", async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: "test@example.com",
          password: "password123",
          name: "Test User",
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("login", () => {
    it("should return tokens for valid credentials", async () => {
      const hash = await bcrypt.hash("password123", 4);
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: hash });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login({
        email: "test@example.com",
        password: "password123",
      });

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
    });

    it("should throw UnauthorizedException for wrong password", async () => {
      const hash = await bcrypt.hash("correct-password", 4);
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: hash });

      await expect(
        service.login({ email: "test@example.com", password: "wrong-password" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for non-existent user", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: "nobody@example.com", password: "password123" }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("refresh", () => {
    it("should rotate tokens on valid refresh", async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: "user-1", email: "test@example.com" });
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: "rt-1",
        tokenHash: "hash",
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh("valid-refresh-token");

      expect(result).toHaveProperty("accessToken");
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "rt-1" },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });

    it("should throw on invalid refresh token", async () => {
      jwt.verifyAsync.mockRejectedValue(new Error("invalid"));

      await expect(service.refresh("bad-token")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw on expired stored token", async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: "user-1", email: "test@example.com" });
      prisma.refreshToken.findFirst.mockResolvedValue({
        id: "rt-1",
        tokenHash: "hash",
        expiresAt: new Date(Date.now() - 86400000),
        revokedAt: null,
      });

      await expect(service.refresh("expired-token")).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("logout", () => {
    it("should revoke the refresh token", async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.logout("user-1", "token-to-revoke");

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: "user-1" }),
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });
  });
});
