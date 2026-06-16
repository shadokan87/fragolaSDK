import { describe, it, expect } from "vitest";
import { BadUsage } from "../../src/exceptions";
import { createTestClient } from "./createTestClient";

const fragola = createTestClient();

describe("context instructions wildcard scope", () => {
  it("instructions('*') returns merged instructions and '*' is reserved for set/remove", async () => {
    const agent = fragola.agent({ name: "wildcard-agent", instructions: "base", description: "" });

    // add a few scoped instruction fragments (out-of-order to exercise sorting)
    agent.context.setInstructions("scoped-b", "b");
    agent.context.setInstructions("scoped-a", "a");
    agent.context.setInstructions("scoped-c", "c");

    // wildcard should return merged instructions in deterministic (sorted) order
    const merged = agent.context.instructions("*");
    expect(merged).toBe("base\nscoped-a\nscoped-b\nscoped-c");

    // individual scopes should still be retrievable
    expect(agent.context.instructions("a")).toBe("scoped-a");
    expect(agent.context.instructions("b")).toBe("scoped-b");

    // setting '*' as a scope should throw — assert by message to avoid cross-module instanceof issues
    expect(() => agent.context.setInstructions("illegal", "*")).toThrow(/reserved instructions scope/);

    // removing '*' should throw — assert by message
    expect(() => agent.context.removeInstructions("*")).toThrow(/reserved instructions scope/);
  });
});