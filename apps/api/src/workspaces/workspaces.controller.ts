import { Body, Controller, Get, Post } from "@nestjs/common";
import {
  CreateWorkspaceSchema,
  type CreateWorkspaceDto,
} from "@synapse/shared";
import { WorkspacesService } from "./workspaces.service";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

@Controller("workspaces")
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.workspaces.listForUser(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateWorkspaceSchema)) dto: CreateWorkspaceDto,
  ) {
    return this.workspaces.create(user.id, dto);
  }
}
