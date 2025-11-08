import { describe, it, expect, beforeEach } from "vitest";
import { createStore } from "@fragola-ai/agentic-sdk-core/store";
import { Fragola } from "@fragola-ai/agentic-sdk-core";
import type { Tool } from "@fragola-ai/agentic-sdk-core";
import { z } from "zod";

process.env["OPENAI_API_KEY"] = process.env["OPENAI_API_KEY"] ?? "xxx";

// Helper to create a simple store
const getTestStore = (namespace = "test") =>
  createStore({ value: 42 }, namespace);

// Helper to create test tools
const createTestTool = (name: string, description = "Test tool"): Tool<any> => ({
  name,
  description,
  schema: z.object({ input: z.string() }),
  handler: async (params) => `${name} result`,
});

describe("Agent Context - updateTools", () => {
  let fragola: Fragola;

  beforeEach(() => {
    fragola = new Fragola({ model: "gpt-3" });
  });

  it("should initialize agent with tools", () => {
    const tool1 = createTestTool("tool1", "First tool");
    const tool2 = createTestTool("tool2", "Second tool");

    const agent = fragola.agent({
      name: "testAgent",
      instructions: "Test instructions",
      description: "Test description",
      store: getTestStore("main"),
      tools: [tool1, tool2],
    });

    const tools = agent.options.tools;
    expect(tools).toBeDefined();
    expect(tools).toHaveLength(2);
    expect(tools?.[0].name).toBe("tool1");
    expect(tools?.[1].name).toBe("tool2");
  });

  it("should add a new tool via updateTools", () => {
    const tool1 = createTestTool("tool1");
    const tool2 = createTestTool("tool2");

    const agent = fragola.agent({
      name: "testAgent",
      instructions: "Test instructions",
      description: "Test description",
      store: getTestStore("main"),
      tools: [tool1],
    });

    agent.context.updateTools((prev) => [...prev, tool2]);

    const tools = agent.options.tools;
    expect(tools).toHaveLength(2);
    expect(tools?.[0].name).toBe("tool1");
    expect(tools?.[1].name).toBe("tool2");
  });

  it("should remove a tool via updateTools", () => {
    const tool1 = createTestTool("tool1");
    const tool2 = createTestTool("tool2");
    const tool3 = createTestTool("tool3");

    const agent = fragola.agent({
      name: "testAgent",
      instructions: "Test instructions",
      description: "Test description",
      store: getTestStore("main"),
      tools: [tool1, tool2, tool3],
    });

    agent.context.updateTools((prev) => prev.filter((t) => t.name !== "tool2"));

    const tools = agent.options.tools;
    expect(tools).toHaveLength(2);
    expect(tools?.[0].name).toBe("tool1");
    expect(tools?.[1].name).toBe("tool3");
  });

  it("should replace all tools via updateTools", () => {
    const tool1 = createTestTool("tool1");
    const tool2 = createTestTool("tool2");
    const tool3 = createTestTool("tool3");

    const agent = fragola.agent({
      name: "testAgent",
      instructions: "Test instructions",
      description: "Test description",
      store: getTestStore("main"),
      tools: [tool1],
    });

    agent.context.updateTools(() => [tool2, tool3]);

    const tools = agent.options.tools;
    expect(tools).toHaveLength(2);
    expect(tools?.[0].name).toBe("tool2");
    expect(tools?.[1].name).toBe("tool3");
  });

  it("should handle empty tools array", () => {
    const tool1 = createTestTool("tool1");

    const agent = fragola.agent({
      name: "testAgent",
      instructions: "Test instructions",
      description: "Test description",
      store: getTestStore("main"),
      tools: [tool1],
    });

    agent.context.updateTools(() => []);

    const tools = agent.options.tools;
    expect(tools).toHaveLength(0);
  });

  it("should work with agent initialized without tools", () => {
    const agent = fragola.agent({
      name: "testAgent",
      instructions: "Test instructions",
      description: "Test description",
      store: getTestStore("main"),
    });

    const tool1 = createTestTool("tool1");
    agent.context.updateTools((prev) => [...prev, tool1]);

    const tools = agent.options.tools;
    expect(tools).toHaveLength(1);
    expect(tools?.[0].name).toBe("tool1");
  });

  it("should update paramsTools when updateTools is called", () => {
    const tool1 = createTestTool("tool1");
    const tool2 = createTestTool("tool2");

    const agent = fragola.agent({
      name: "testAgent",
      instructions: "Test instructions",
      description: "Test description",
      store: getTestStore("main"),
      tools: [tool1],
    });

    // Get initial paramsTools count (private, but we can infer through options)
    const initialTools = agent.options.tools;
    expect(initialTools).toHaveLength(1);

    agent.context.updateTools((prev) => [...prev, tool2]);

    const updatedTools = agent.options.tools;
    expect(updatedTools).toHaveLength(2);
  });

  it("should allow modifying existing tools in updateTools", () => {
    const tool1 = createTestTool("tool1", "Original description");
    const tool2 = createTestTool("tool2");

    const agent = fragola.agent({
      name: "testAgent",
      instructions: "Test instructions",
      description: "Test description",
      store: getTestStore("main"),
      tools: [tool1, tool2],
    });

    agent.context.updateTools((prev) =>
      prev.map((t) =>
        t.name === "tool1" ? { ...t, description: "Updated description" } : t
      )
    );

    const tools = agent.options.tools;
    expect(tools?.[0].description).toBe("Updated description");
    expect(tools?.[1].name).toBe("tool2");
  });

  it("should handle callback with multiple operations", () => {
    const tool1 = createTestTool("tool1");
    const tool2 = createTestTool("tool2");
    const tool3 = createTestTool("tool3");
    const tool4 = createTestTool("tool4");

    const agent = fragola.agent({
      name: "testAgent",
      instructions: "Test instructions",
      description: "Test description",
      store: getTestStore("main"),
      tools: [tool1, tool2],
    });

    // Remove tool2, add tool3 and tool4
    agent.context.updateTools((prev) => [
      ...prev.filter((t) => t.name !== "tool2"),
      tool3,
      tool4,
    ]);

    const tools = agent.options.tools;
    expect(tools).toHaveLength(3);
    expect(tools?.map((t) => t.name)).toEqual(["tool1", "tool3", "tool4"]);
  });
});
