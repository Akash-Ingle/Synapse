import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import {
  CreateVersionSchema,
  type CreateVersionDto,
} from "@synapse/shared";
import { VersionsService } from "./versions.service";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

@Controller("documents/:id/versions")
export class VersionsController {
  constructor(private readonly versions: VersionsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.versions.list(user.id, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateVersionSchema)) dto: CreateVersionDto,
  ) {
    return this.versions.snapshot(user.id, id, dto.label);
  }

  @Get(":versionNo")
  getContent(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("versionNo", ParseIntPipe) versionNo: number,
  ) {
    return this.versions.getContent(user.id, id, versionNo);
  }

  @Post(":versionNo/restore")
  restore(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("versionNo", ParseIntPipe) versionNo: number,
  ) {
    return this.versions.restore(user.id, id, versionNo);
  }
}
