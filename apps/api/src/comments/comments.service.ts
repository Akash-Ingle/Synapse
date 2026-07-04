import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DocumentRole, type CreateCommentDto } from "@synapse/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsService } from "../permissions/permissions.service";

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  private static readonly COMMENT_SELECT = {
    id: true,
    threadId: true,
    body: true,
    quotedText: true,
    anchor: true,
    resolved: true,
    createdAt: true,
    authorId: true,
    author: { select: { id: true, name: true, avatarUrl: true } },
  } as const;

  async list(userId: string, documentId: string) {
    await this.permissions.requireRole(userId, documentId, DocumentRole.VIEWER);
    return this.prisma.comment.findMany({
      where: { documentId },
      orderBy: { createdAt: "asc" },
      select: CommentsService.COMMENT_SELECT,
    });
  }

  async create(userId: string, documentId: string, dto: CreateCommentDto) {
    await this.permissions.requireRole(userId, documentId, DocumentRole.COMMENTER);
    const threadId = dto.threadId ?? randomUUID();
    return this.prisma.comment.create({
      data: {
        documentId,
        threadId,
        authorId: userId,
        body: dto.body,
        quotedText: dto.quotedText ?? null,
        anchor: dto.anchor ?? undefined,
      },
      select: CommentsService.COMMENT_SELECT,
    });
  }

  async setResolved(userId: string, documentId: string, threadId: string, resolved: boolean) {
    await this.permissions.requireRole(userId, documentId, DocumentRole.COMMENTER);
    await this.prisma.comment.updateMany({
      where: { documentId, threadId },
      data: { resolved },
    });
    return { ok: true };
  }

  async remove(userId: string, documentId: string, commentId: string) {
    const role = await this.permissions.requireRole(userId, documentId, DocumentRole.COMMENTER);
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorId: true, documentId: true },
    });
    if (!comment || comment.documentId !== documentId) {
      throw new NotFoundException("Comment not found");
    }
    // Authors can delete their own comments; owners can delete any.
    if (comment.authorId !== userId && role !== DocumentRole.OWNER) {
      throw new ForbiddenException("Cannot delete another user's comment");
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
    return { ok: true };
  }
}
