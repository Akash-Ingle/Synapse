import { Inject, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Queue, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
import { AI_QUEUE, JobType, type AiJobData } from "@synapse/shared";
import { APP_CONFIG } from "../config/config.module";
import type { AppConfig } from "../config/configuration";

/**
 * Producer side of the background AI pipeline. Enqueues jobs consumed by @synapse/worker.
 * Failures are swallowed with a warning so the request path never breaks if Redis is down.
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly connection: IORedis;
  private readonly queue: Queue;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
    // Cast avoids a spurious type clash from BullMQ's bundled copy of ioredis.
    this.queue = new Queue(AI_QUEUE, {
      connection: this.connection as unknown as ConnectionOptions,
    });
  }

  async enqueueDocumentProcessing(documentId: string): Promise<void> {
    try {
      await this.queue.add(
        JobType.EMBED_DOCUMENT,
        { type: JobType.EMBED_DOCUMENT, documentId },
        { attempts: 3, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 100 },
      );
      await this.queue.add(
        JobType.TAG_DOCUMENT,
        { type: JobType.TAG_DOCUMENT, documentId },
        { attempts: 3, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 100 },
      );
    } catch (err) {
      this.logger.warn(`Failed to enqueue processing for ${documentId}: ${String(err)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}
