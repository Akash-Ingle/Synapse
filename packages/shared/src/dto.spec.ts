import {
  RegisterSchema,
  LoginSchema,
  RefreshSchema,
  CreateWorkspaceSchema,
  CreateDocumentSchema,
  UpdateDocumentSchema,
  ShareDocumentSchema,
  CreateCommentSchema,
  CreateVersionSchema,
} from "./dto";

describe("DTO Schemas", () => {
  describe("RegisterSchema", () => {
    it("should accept valid registration", () => {
      const result = RegisterSchema.safeParse({
        email: "user@example.com",
        password: "password123",
        name: "John Doe",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid email", () => {
      const result = RegisterSchema.safeParse({
        email: "not-email",
        password: "password123",
        name: "John",
      });
      expect(result.success).toBe(false);
    });

    it("should reject short password", () => {
      const result = RegisterSchema.safeParse({
        email: "user@example.com",
        password: "short",
        name: "John",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty name", () => {
      const result = RegisterSchema.safeParse({
        email: "user@example.com",
        password: "password123",
        name: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("LoginSchema", () => {
    it("should accept valid login", () => {
      const result = LoginSchema.safeParse({
        email: "user@example.com",
        password: "any-password",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing password", () => {
      const result = LoginSchema.safeParse({ email: "user@example.com" });
      expect(result.success).toBe(false);
    });
  });

  describe("RefreshSchema", () => {
    it("should accept a non-empty token", () => {
      const result = RefreshSchema.safeParse({ refreshToken: "some-token" });
      expect(result.success).toBe(true);
    });

    it("should reject empty token", () => {
      const result = RefreshSchema.safeParse({ refreshToken: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("CreateWorkspaceSchema", () => {
    it("should accept valid workspace name", () => {
      const result = CreateWorkspaceSchema.safeParse({ name: "My Workspace" });
      expect(result.success).toBe(true);
    });

    it("should reject name over 120 chars", () => {
      const result = CreateWorkspaceSchema.safeParse({ name: "a".repeat(121) });
      expect(result.success).toBe(false);
    });
  });

  describe("CreateDocumentSchema", () => {
    it("should accept with defaults", () => {
      const result = CreateDocumentSchema.safeParse({
        workspaceId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Untitled");
        expect(result.data.docType).toBe("doc");
      }
    });

    it("should reject invalid UUID for workspaceId", () => {
      const result = CreateDocumentSchema.safeParse({
        workspaceId: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("UpdateDocumentSchema", () => {
    it("should accept partial updates", () => {
      const result = UpdateDocumentSchema.safeParse({ title: "New Title" });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = UpdateDocumentSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should reject title over 200 chars", () => {
      const result = UpdateDocumentSchema.safeParse({ title: "t".repeat(201) });
      expect(result.success).toBe(false);
    });
  });

  describe("ShareDocumentSchema", () => {
    it("should accept valid share request", () => {
      const result = ShareDocumentSchema.safeParse({
        email: "collab@example.com",
        role: "editor",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid role", () => {
      const result = ShareDocumentSchema.safeParse({
        email: "collab@example.com",
        role: "superadmin",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("CreateCommentSchema", () => {
    it("should accept a simple comment", () => {
      const result = CreateCommentSchema.safeParse({ body: "Great point!" });
      expect(result.success).toBe(true);
    });

    it("should accept a threaded reply", () => {
      const result = CreateCommentSchema.safeParse({
        body: "I agree",
        threadId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty body", () => {
      const result = CreateCommentSchema.safeParse({ body: "" });
      expect(result.success).toBe(false);
    });

    it("should reject body over 4000 chars", () => {
      const result = CreateCommentSchema.safeParse({ body: "x".repeat(4001) });
      expect(result.success).toBe(false);
    });
  });

  describe("CreateVersionSchema", () => {
    it("should accept optional label", () => {
      const result = CreateVersionSchema.safeParse({ label: "v1.0" });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = CreateVersionSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});
