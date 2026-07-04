import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DocumentRole,
  type CreateDocumentDto,
  type ShareDocumentDto,
  type UpdateDocumentDto,
} from "@synapse/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsService } from "../permissions/permissions.service";

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async listForWorkspace(userId: string, workspaceId: string) {
    await this.permissions.requireWorkspaceMember(userId, workspaceId);
    return this.prisma.document.findMany({
      where: {
        workspaceId,
        isArchived: false,
        OR: [
          { workspace: { ownerId: userId } },
          { permissions: { some: { userId } } },
          { workspace: { members: { some: { userId, role: "admin" } } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        docType: true,
        updatedAt: true,
        createdById: true,
        tags: { select: { tag: true, source: true } },
      },
    });
  }

  async create(userId: string, dto: CreateDocumentDto) {
    await this.permissions.requireWorkspaceMember(userId, dto.workspaceId);
    return this.prisma.document.create({
      data: {
        workspaceId: dto.workspaceId,
        title: dto.title,
        docType: dto.docType,
        createdById: userId,
        permissions: { create: { userId, role: DocumentRole.OWNER } },
      },
      select: { id: true, title: true, docType: true, workspaceId: true },
    });
  }

  async getOne(userId: string, documentId: string) {
    const role = await this.permissions.requireRole(userId, documentId, DocumentRole.VIEWER);
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        title: true,
        docType: true,
        workspaceId: true,
        contentText: true,
        currentVersionNo: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
        tags: { select: { tag: true, source: true } },
      },
    });
    if (!doc) throw new NotFoundException("Document not found");
    return { ...doc, myRole: role };
  }

  async update(userId: string, documentId: string, dto: UpdateDocumentDto) {
    await this.permissions.requireRole(userId, documentId, DocumentRole.EDITOR);
    return this.prisma.document.update({
      where: { id: documentId },
      data: dto,
      select: { id: true, title: true, docType: true, isArchived: true },
    });
  }

  async remove(userId: string, documentId: string) {
    await this.permissions.requireRole(userId, documentId, DocumentRole.OWNER);
    await this.prisma.document.delete({ where: { id: documentId } });
    return { ok: true };
  }

  async listCollaborators(userId: string, documentId: string) {
    await this.permissions.requireRole(userId, documentId, DocumentRole.VIEWER);
    return this.prisma.documentPermission.findMany({
      where: { documentId },
      select: {
        role: true,
        user: { select: { id: true, email: true, name: true, avatarUrl: true } },
      },
    });
  }

  async share(userId: string, documentId: string, dto: ShareDocumentDto) {
    await this.permissions.requireRole(userId, documentId, DocumentRole.OWNER);
    const target = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!target) throw new NotFoundException("No user with that email");
    if (target.id === userId) {
      throw new BadRequestException("You already own this document");
    }
    return this.prisma.documentPermission.upsert({
      where: { documentId_userId: { documentId, userId: target.id } },
      create: { documentId, userId: target.id, role: dto.role },
      update: { role: dto.role },
      select: {
        role: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async revoke(userId: string, documentId: string, targetUserId: string) {
    await this.permissions.requireRole(userId, documentId, DocumentRole.OWNER);
    await this.prisma.documentPermission.deleteMany({
      where: { documentId, userId: targetUserId, role: { not: DocumentRole.OWNER } },
    });
    return { ok: true };
  }
}
