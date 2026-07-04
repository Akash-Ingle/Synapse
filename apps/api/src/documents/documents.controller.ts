import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  CreateDocumentSchema,
  ShareDocumentSchema,
  UpdateDocumentSchema,
  type CreateDocumentDto,
  type ShareDocumentDto,
  type UpdateDocumentDto,
} from "@synapse/shared";
import { DocumentsService } from "./documents.service";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

@Controller("documents")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query("workspaceId", ParseUUIDPipe) workspaceId: string,
  ) {
    return this.documents.listForWorkspace(user.id, workspaceId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateDocumentSchema)) dto: CreateDocumentDto,
  ) {
    return this.documents.create(user.id, dto);
  }

  @Get(":id")
  getOne(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.documents.getOne(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateDocumentSchema)) dto: UpdateDocumentDto,
  ) {
    return this.documents.update(user.id, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.documents.remove(user.id, id);
  }

  @Get(":id/collaborators")
  collaborators(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.documents.listCollaborators(user.id, id);
  }

  @Post(":id/share")
  share(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ShareDocumentSchema)) dto: ShareDocumentDto,
  ) {
    return this.documents.share(user.id, id, dto);
  }

  @Delete(":id/collaborators/:userId")
  revoke(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("userId", ParseUUIDPipe) targetUserId: string,
  ) {
    return this.documents.revoke(user.id, id, targetUserId);
  }
}
