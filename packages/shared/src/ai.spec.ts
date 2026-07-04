import {
  RewriteRequestSchema,
  SummarizeRequestSchema,
  OutlineSchema,
  SemanticSearchRequestSchema,
  TaskExtractionRequestSchema,
  TaskExtractionResultSchema,
  ChatDocRequestSchema,
  StyleAdaptRequestSchema,
  SemanticDiffRequestSchema,
  RewriteMode,
  AiFeature,
  StyleAudience,
} from "./ai";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("AI Schemas", () => {
  describe("RewriteRequestSchema", () => {
    it("should accept valid rewrite request with defaults", () => {
      const result = RewriteRequestSchema.safeParse({
        selection: "Hello world",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe(RewriteMode.IMPROVE);
      }
    });

    it("should accept all rewrite modes", () => {
      for (const mode of Object.values(RewriteMode)) {
        const result = RewriteRequestSchema.safeParse({
          selection: "text",
          mode,
        });
        expect(result.success).toBe(true);
      }
    });

    it("should reject empty selection", () => {
      const result = RewriteRequestSchema.safeParse({ selection: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("SummarizeRequestSchema", () => {
    it("should accept with default length", () => {
      const result = SummarizeRequestSchema.safeParse({ text: "Some content" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe("medium");
      }
    });

    it("should accept all length options", () => {
      for (const length of ["short", "medium", "long"]) {
        const result = SummarizeRequestSchema.safeParse({ text: "x", length });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("SemanticSearchRequestSchema", () => {
    it("should accept valid search request", () => {
      const result = SemanticSearchRequestSchema.safeParse({
        workspaceId: VALID_UUID,
        query: "authentication flow",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
      }
    });

    it("should reject limit over 50", () => {
      const result = SemanticSearchRequestSchema.safeParse({
        workspaceId: VALID_UUID,
        query: "test",
        limit: 100,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("TaskExtractionRequestSchema", () => {
    it("should accept valid request", () => {
      const result = TaskExtractionRequestSchema.safeParse({
        documentId: VALID_UUID,
        text: "Meeting notes with action items",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("TaskExtractionResultSchema", () => {
    it("should accept valid result with tasks", () => {
      const result = TaskExtractionResultSchema.safeParse({
        tasks: [
          { text: "Fix the login bug", priority: "high" },
          { text: "Update docs", owner: "Alice", priority: "low" },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty tasks array", () => {
      const result = TaskExtractionResultSchema.safeParse({ tasks: [] });
      expect(result.success).toBe(true);
    });
  });

  describe("ChatDocRequestSchema", () => {
    it("should accept question with document ID", () => {
      const result = ChatDocRequestSchema.safeParse({
        documentId: VALID_UUID,
        question: "What is the main topic?",
      });
      expect(result.success).toBe(true);
    });

    it("should accept optional editor text", () => {
      const result = ChatDocRequestSchema.safeParse({
        documentId: VALID_UUID,
        question: "Summarize this",
        text: "Some editor content here",
      });
      expect(result.success).toBe(true);
    });

    it("should reject question over 2000 chars", () => {
      const result = ChatDocRequestSchema.safeParse({
        documentId: VALID_UUID,
        question: "q".repeat(2001),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("StyleAdaptRequestSchema", () => {
    it("should accept all audience types", () => {
      for (const audience of Object.values(StyleAudience)) {
        const result = StyleAdaptRequestSchema.safeParse({
          text: "Adapt this text",
          audience,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("SemanticDiffRequestSchema", () => {
    it("should accept valid version range", () => {
      const result = SemanticDiffRequestSchema.safeParse({
        documentId: VALID_UUID,
        fromVersion: 1,
        toVersion: 3,
      });
      expect(result.success).toBe(true);
    });

    it("should reject negative fromVersion", () => {
      const result = SemanticDiffRequestSchema.safeParse({
        documentId: VALID_UUID,
        fromVersion: -1,
        toVersion: 1,
      });
      expect(result.success).toBe(false);
    });

    it("should reject zero toVersion", () => {
      const result = SemanticDiffRequestSchema.safeParse({
        documentId: VALID_UUID,
        fromVersion: 0,
        toVersion: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("OutlineSchema", () => {
    it("should accept valid outline", () => {
      const result = OutlineSchema.safeParse({
        title: "Project Plan",
        sections: [
          { heading: "Introduction", points: ["Background", "Goals"] },
          { heading: "Design", points: ["Architecture"] },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("AiFeature enum", () => {
    it("should contain all expected features", () => {
      expect(AiFeature.REWRITE).toBe("rewrite");
      expect(AiFeature.EXPAND).toBe("expand");
      expect(AiFeature.SUMMARIZE).toBe("summarize");
      expect(AiFeature.OUTLINE).toBe("outline");
      expect(AiFeature.SEMANTIC_SEARCH).toBe("semantic_search");
      expect(AiFeature.TASK_EXTRACTION).toBe("task_extraction");
      expect(AiFeature.CHAT_DOC).toBe("chat_doc");
      expect(AiFeature.NOTES_TO_DOC).toBe("notes_to_doc");
      expect(AiFeature.STYLE_ADAPT).toBe("style_adapt");
      expect(AiFeature.SEMANTIC_DIFF).toBe("semantic_diff");
    });
  });
});
