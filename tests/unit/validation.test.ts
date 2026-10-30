import { describe, expect, it } from "vitest";
import { USERNAME_RE, displayNameSchema, usernameSchema } from "@/lib/validation";

describe("usernameSchema (mirrors profiles_username_format)", () => {
  it.each(["abc", "a_b_c", "user123", "x".repeat(20), "  Kenny_99 "])("accepts %j", (v) => {
    const r = usernameSchema.safeParse(v);
    expect(r.success).toBe(true);
    if (r.success) expect(USERNAME_RE.test(r.data)).toBe(true);
  });

  it("normalizes to trimmed lowercase", () => {
    expect(usernameSchema.parse("  MiXeD_Case ")).toBe("mixed_case");
  });

  it.each(["ab", "x".repeat(21), "has space", "dash-name", "dot.name", "émile", "", "😀abc"])(
    "rejects %j",
    (v) => expect(usernameSchema.safeParse(v).success).toBe(false),
  );
});

describe("displayNameSchema", () => {
  it("accepts 1–50 chars after trim", () => {
    expect(displayNameSchema.parse("  Kenny ")).toBe("Kenny");
    expect(displayNameSchema.safeParse("x".repeat(50)).success).toBe(true);
  });
  it("rejects empty and overlong", () => {
    expect(displayNameSchema.safeParse("   ").success).toBe(false);
    expect(displayNameSchema.safeParse("x".repeat(51)).success).toBe(false);
  });
});
