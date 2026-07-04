import {
  DocumentRole,
  WorkspaceRole,
  DOCUMENT_ROLE_RANK,
  hasAtLeastDocumentRole,
  canEditDocument,
  canCommentOnDocument,
  canManageDocument,
} from "./roles";

describe("Roles", () => {
  describe("constants", () => {
    it("should define workspace roles", () => {
      expect(WorkspaceRole.ADMIN).toBe("admin");
      expect(WorkspaceRole.MEMBER).toBe("member");
    });

    it("should define document roles", () => {
      expect(DocumentRole.OWNER).toBe("owner");
      expect(DocumentRole.EDITOR).toBe("editor");
      expect(DocumentRole.COMMENTER).toBe("commenter");
      expect(DocumentRole.VIEWER).toBe("viewer");
    });

    it("should rank roles in ascending capability order", () => {
      expect(DOCUMENT_ROLE_RANK[DocumentRole.VIEWER]).toBeLessThan(
        DOCUMENT_ROLE_RANK[DocumentRole.COMMENTER],
      );
      expect(DOCUMENT_ROLE_RANK[DocumentRole.COMMENTER]).toBeLessThan(
        DOCUMENT_ROLE_RANK[DocumentRole.EDITOR],
      );
      expect(DOCUMENT_ROLE_RANK[DocumentRole.EDITOR]).toBeLessThan(
        DOCUMENT_ROLE_RANK[DocumentRole.OWNER],
      );
    });
  });

  describe("hasAtLeastDocumentRole", () => {
    it("should return true when actual meets required", () => {
      expect(hasAtLeastDocumentRole("owner", "editor")).toBe(true);
      expect(hasAtLeastDocumentRole("editor", "editor")).toBe(true);
      expect(hasAtLeastDocumentRole("owner", "viewer")).toBe(true);
    });

    it("should return false when actual is below required", () => {
      expect(hasAtLeastDocumentRole("viewer", "editor")).toBe(false);
      expect(hasAtLeastDocumentRole("commenter", "editor")).toBe(false);
    });

    it("should return false for null/undefined", () => {
      expect(hasAtLeastDocumentRole(null, "viewer")).toBe(false);
      expect(hasAtLeastDocumentRole(undefined, "viewer")).toBe(false);
    });
  });

  describe("canEditDocument", () => {
    it("should allow editor and owner", () => {
      expect(canEditDocument("owner")).toBe(true);
      expect(canEditDocument("editor")).toBe(true);
    });

    it("should deny viewer and commenter", () => {
      expect(canEditDocument("viewer")).toBe(false);
      expect(canEditDocument("commenter")).toBe(false);
    });

    it("should deny null", () => {
      expect(canEditDocument(null)).toBe(false);
    });
  });

  describe("canCommentOnDocument", () => {
    it("should allow commenter and above", () => {
      expect(canCommentOnDocument("owner")).toBe(true);
      expect(canCommentOnDocument("editor")).toBe(true);
      expect(canCommentOnDocument("commenter")).toBe(true);
    });

    it("should deny viewer", () => {
      expect(canCommentOnDocument("viewer")).toBe(false);
    });
  });

  describe("canManageDocument", () => {
    it("should only allow owner", () => {
      expect(canManageDocument("owner")).toBe(true);
    });

    it("should deny all others", () => {
      expect(canManageDocument("editor")).toBe(false);
      expect(canManageDocument("commenter")).toBe(false);
      expect(canManageDocument("viewer")).toBe(false);
    });
  });
});
