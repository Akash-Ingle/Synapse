import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DocumentRole,
  hasAtLeastDocumentRole,
} from "@synapse/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves the effective document role for a user, considering:
   *  - workspace ownership / admin membership (implicit owner)
   *  - explicit per-document permission grants
   * Returns null when the user has no access.
   */
  async resolveRole(userId: string, documentId: string): Promise<DocumentRole | null> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        workspaceId: true,
        workspace: { select: { ownerId: true } },
        permissions: { where: { userId }, select: { role: true } },
      },
    });
    if (!doc) throw new NotFoundException("Document not found");

    if (doc.workspace.ownerId === userId) return DocumentRole.OWNER;

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: doc.workspaceId, userId } },
      select: { role: true },
    });
    if (membership?.role === "admin") return DocumentRole.OWNER;

    const explicit = doc.permissions[0]?.role as DocumentRole | undefined;
    return explicit ?? null;
  }

  /** Throws unless the user has at least `required` on the document. Returns the actual role. */
  async requireRole(
    userId: string,
    documentId: string,
    required: DocumentRole,
  ): Promise<DocumentRole> {
    const role = await this.resolveRole(userId, documentId);
    if (!hasAtLeastDocumentRole(role, required)) {
      throw new ForbiddenException("Insufficient permissions for this document");
    }
    return role as DocumentRole;
  }

  /** Ensures the user is a member of the workspace (owner or member). */
  async requireWorkspaceMember(userId: string, workspaceId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });
    if (!workspace) throw new NotFoundException("Workspace not found");
    if (workspace.ownerId === userId) return;

    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership) throw new ForbiddenException("Not a member of this workspace");
  }
}
