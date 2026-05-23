import { describe, expect, it } from "vitest";
import { guardrail } from "@fragola-ai/hook-guardrail";

describe("hook-guardrail", () => {
  it("exports the guardrail hook", () => {
    expect(typeof guardrail).toBe("function");
  });
});