import { describe, expect, it } from "vitest";
import { mcpClient, mcpTools } from "@fragola-ai/hook-mcp-tools";

describe("hook-mcp-tools", () => {
  it("exports hook helpers", () => {
    expect(typeof mcpTools).toBe("function");
    expect(mcpClient).toBe(mcpTools);
  });
});