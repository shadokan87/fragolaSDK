import { describe, it, expect, vi } from "vitest";
import { createTestClient } from "./createTestClient";

const fragola = createTestClient();

const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe("Agent.dispose()", () => {
  it("calls disposers for named and unnamed hooks and unregisters named hooks", async () => {
    const namedDispose = vi.fn(async () => {});
    const unnamedDispose = vi.fn(async () => {});

    const agent = fragola.agent({
      name: "dispose-agent",
      instructions: "",
      description: "",
    });

    agent.use(() => namedDispose, "named-hook");
    agent.use(() => unnamedDispose);

    await agent.dispose();

    expect(namedDispose).toHaveBeenCalledTimes(1);
    expect(unnamedDispose).toHaveBeenCalledTimes(1);
    expect(agent.hasHook("named-hook")).toBe(false);
  });

  it("waits for pending hook initialization and disposes them", async () => {
    const gate = createDeferred();
    const disposed: string[] = [];

    const agent = fragola.agent({ name: "dispose-agent-2", instructions: "", description: "" });

    agent.use(async () => {
      await gate.promise;
      return async () => {
        disposed.push("disposed");
      };
    }, "delayed");

    const disposing = agent.dispose();
    // allow microtasks to run; dispose should be waiting for hook init
    await Promise.resolve();

    // now resolve initialization
    gate.resolve();
    await disposing;

    expect(disposed).toEqual(["disposed"]);
    expect(agent.hasHook("delayed")).toBe(false);
  });
});
