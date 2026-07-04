import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { LlmProvider } from "./providers/llm.provider";
import { EmbeddingsProvider } from "./providers/embeddings.provider";

@Module({
  controllers: [AiController],
  providers: [AiService, LlmProvider, EmbeddingsProvider],
  exports: [AiService, LlmProvider, EmbeddingsProvider],
})
export class AiModule {}
