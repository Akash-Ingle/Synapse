import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { ConfigModule } from "./config/config.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PermissionsModule } from "./permissions/permissions.module";
import { QueueModule } from "./queue/queue.module";
import { MetricsModule } from "./metrics/metrics.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { WorkspacesModule } from "./workspaces/workspaces.module";
import { DocumentsModule } from "./documents/documents.module";
import { VersionsModule } from "./versions/versions.module";
import { CommentsModule } from "./comments/comments.module";
import { AiModule } from "./ai/ai.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== "production"
            ? { target: "pino-pretty", options: { singleLine: true } }
            : undefined,
        autoLogging: true,
        redact: ["req.headers.authorization"],
      },
    }),
    ConfigModule,
    PrismaModule,
    PermissionsModule,
    QueueModule,
    MetricsModule,
    HealthModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    DocumentsModule,
    VersionsModule,
    CommentsModule,
    AiModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
