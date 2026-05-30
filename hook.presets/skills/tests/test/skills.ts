import { describe, expect, it } from "vitest";
import { orchestration, OrchestrationBadConfig } from "@fragola-ai/hook-orchestration";

describe("hook-orchestration", () => {
  it("exports hook helpers", () => {
    expect(typeof orchestration).toBe("function");
    expect(typeof OrchestrationBadConfig).toBe("function");
  });
});