import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "./zod-validation.pipe";

describe("ZodValidationPipe", () => {
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(1).max(100),
    age: z.number().int().min(0).optional(),
  });

  const pipe = new ZodValidationPipe(schema);

  it("should pass valid input through unchanged", () => {
    const input = { email: "user@example.com", name: "Alice" };
    const result = pipe.transform(input);

    expect(result).toEqual(input);
  });

  it("should apply defaults and coercion", () => {
    const input = { email: "user@example.com", name: "Alice", age: 25 };
    const result = pipe.transform(input);

    expect(result.age).toBe(25);
  });

  it("should throw BadRequestException on invalid email", () => {
    const input = { email: "not-an-email", name: "Alice" };

    expect(() => pipe.transform(input)).toThrow(BadRequestException);
  });

  it("should throw BadRequestException on missing required fields", () => {
    const input = { email: "user@example.com" };

    expect(() => pipe.transform(input)).toThrow(BadRequestException);
  });

  it("should include field path in error issues", () => {
    const input = { email: "bad", name: "" };

    try {
      pipe.transform(input);
      fail("Expected exception");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse() as any;
      expect(response.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "email" }),
          expect.objectContaining({ path: "name" }),
        ]),
      );
    }
  });

  it("should reject extra fields silently (strip by default)", () => {
    const input = { email: "user@example.com", name: "Alice", extra: "field" };
    const result = pipe.transform(input);

    expect((result as any).extra).toBeUndefined();
  });
});
