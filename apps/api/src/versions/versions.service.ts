import { Injectable, NotFoundException } from "@nestjs/common";
import { DocumentRole } from "@synapse/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionsService } from "../permissions/permissions.service";
import { QueueService } from "../queue/queue.service";

@Injectable()
export class VersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly queue: QueueService,
  ) {}

  async list(userId: string, documentId: string) {
    await this.permissions.requireRole(userId, documentId, DocumentRole.VIEWER);
    return this.prisma.version.findMany({
      where: { documentId },
      orderBy: { versionNo: "desc" },
      select: {
        id: true,
        versionNo: true,
        label: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
      },
    });
  }

  /** Creates an immutable snapshot from the document's current CRDT state + flattened text. */
  async snapshot(userId: string, documentId: string, label?: string) {
    await this.permissions.requireRole(userId, documentId, DocumentRole.EDITOR);
    return this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.findUnique({
        where: { id: documentId },
        select: { ydocState: true, contentText: true, currentVersionNo: true },
      });
      if (!doc) throw new NotFoundException("Document not found");

      const nextNo = doc.currentVersionNo + 1;
      const version = await tx.version.create({
        data: {
          documentId,
          versionNo: nextNo,
          label,
          snapshot: doc.ydocState ?? undefined,
          contentText: doc.contentText,
          createdById: userId,
        },
        select: { id: true, versionNo: true, label: true, createdAt: true },
      });
      await tx.document.update({
        where: { id: documentId },
        data: { currentVersionNo: nextNo },
      });
      return version;
    }).then(async (version) => {
      // A snapshot is a natural checkpoint to (re)build embeddings + tags in the background.
      await this.queue.enqueueDocumentProcessing(documentId);
      return version;
    });
  }

  async getContent(userId: string, documentId: string, versionNo: number) {
    await this.permissions.requireRole(userId, documentId, DocumentRole.VIEWER);
    const version = await this.prisma.version.findUnique({
      where: { documentId_versionNo: { documentId, versionNo } },
      select: { versionNo: true, label: true, contentText: true, createdAt: true },
    });
    if (!version) throw new NotFoundException("Version not found");
    return version;
  }

  /**
   * Non-destructive restore: snapshots the current state, then rolls the live document
   * content back to the target version's snapshot. History stays append-only.
   */
  async restore(userId: string, documentId: string, versionNo: number) {
    await this.permissions.requireRole(userId, documentId, DocumentRole.EDITOR);
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.version.findUnique({
        where: { documentId_versionNo: { documentId, versionNo } },
        select: { snapshot: true, contentText: true },
      });
      if (!target) throw new NotFoundException("Version not found");

      const doc = await tx.document.findUnique({
        where: { id: documentId },
        select: { ydocState: true, contentText: true, currentVersionNo: true },
      });
      if (!doc) throw new NotFoundException("Document not found");

      const backupNo = doc.currentVersionNo + 1;
      await tx.version.create({
        data: {
          documentId,
          versionNo: backupNo,
          label: `Auto-backup before restore of v${versionNo}`,
          snapshot: doc.ydocState ?? undefined,
          contentText: doc.contentText,
          createdById: userId,
        },
      });

      await tx.document.update({
        where: { id: documentId },
        data: {
          ydocState: target.snapshot ?? undefined,
          contentText: target.contentText,
          currentVersionNo: backupNo,
        },
      });
      return { ok: true, restoredFrom: versionNo, backupVersion: backupNo };
    });
  }
}
