import { beforeEach, describe, expect, it } from "vitest";
import { createTestClient } from "./createTestClient";

let fragola: ReturnType<typeof createTestClient>;

beforeEach(() => {
  fragola = createTestClient();
});

describe("AgentContext.systemPrompt getter", () => {
  it("returns default instructions when no scopes set", () => {
    const agent = fragola.agent({ name: "sp1", instructions: "base", description: "" });
    expect(agent.context.systemPrompt).toBe("base");
  });

  it("merges scoped instructions deterministically and updates on set/remove", () => {
    const agent = fragola.agent({ name: "sp2", instructions: "base", description: "" });

    agent.context.setInstructions("scoped-b", "b");
    agent.context.setInstructions("scoped-a", "a");

    // scopes are merged in sorted order of their keys: a then b
    expect(agent.context.systemPrompt).toBe("base\nscoped-a\nscoped-b");

    agent.context.removeInstructions("a");
    expect(agent.context.systemPrompt).toBe("base\nscoped-b");

    agent.context.setInstructions("new-base");
    expect(agent.context.systemPrompt).toBe("new-base\nscoped-b");
  });

  it("returns empty string when instructions undefined or empty", () => {
    const agent = fragola.agent({ name: "sp3", instructions: "", description: "" });
    expect(agent.context.systemPrompt).toBe("");
    agent.context.setInstructions("x");
    expect(agent.context.systemPrompt).toBe("x");
  });
});
