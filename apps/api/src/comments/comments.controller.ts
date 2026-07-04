import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import {
  CreateCommentSchema,
  type CreateCommentDto,
} from "@synapse/shared";
import { CommentsService } from "./comments.service";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

@Controller("documents/:id/comments")
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.comments.list(user.id, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateCommentSchema)) dto: CreateCommentDto,
  ) {
    return this.comments.create(user.id, id, dto);
  }

  @Patch("threads/:threadId/resolve")
  resolve(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("threadId", ParseUUIDPipe) threadId: string,
  ) {
    return this.comments.setResolved(user.id, id, threadId, true);
  }

  @Patch("threads/:threadId/reopen")
  reopen(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("threadId", ParseUUIDPipe) threadId: string,
  ) {
    return this.comments.setResolved(user.id, id, threadId, false);
  }

  @Delete(":commentId")
  remove(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("commentId", ParseUUIDPipe) commentId: string,
  ) {
    return this.comments.remove(user.id, id, commentId);
  }
}
