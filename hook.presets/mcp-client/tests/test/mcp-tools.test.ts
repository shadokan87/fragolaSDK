import { describe, expect, it } from "vitest";
import { mcpClient, mcpTools } from "@fragola-ai/hook-mcp-client";

describe("hook-mcp-client", () => {
  it("exports hook helpers", () => {
    expect(typeof mcpTools).toBe("function");
    expect(mcpClient).toBe(mcpTools);
  });
});