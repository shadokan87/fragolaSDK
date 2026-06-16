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
  it("calls disposers for hooks that have already finished loading and unregisters named hooks", async () => {
    const namedDispose = vi.fn(async () => {});
    const unnamedDispose = vi.fn(async () => {});

    const agent = fragola.agent({
      name: "dispose-agent",
      instructions: "",
      description: "",
    });

    agent.use(() => namedDispose, "named-hook");
    agent.use(() => unnamedDispose);

    await agent.init();

    await (agent as Record<string, any>)["dispose"]();

    expect(namedDispose).toHaveBeenCalledTimes(1);
    expect(unnamedDispose).toHaveBeenCalledTimes(1);
    expect(agent.hasHook("named-hook")).toBe(false);
  });

  it("cancels pending hook initialization without waiting for it to load", async () => {
    const gate = createDeferred();
    const disposed = vi.fn(async () => {});

    const agent = fragola.agent({ name: "dispose-agent-2", instructions: "", description: "" });

    agent.use(async () => {
      await gate.promise;
      return disposed;
    }, "delayed");

    await expect((agent as Record<string, any>)["dispose"]()).resolves.toBeUndefined();
    expect(agent.hasHook("delayed")).toBe(false);

    gate.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(disposed).not.toHaveBeenCalled();
    expect(agent.hasHook("delayed")).toBe(false);
  });

  it("does not re-register or dispose a hook that was still initializing when dispose is called", async () => {
    const gate = createDeferred();
    const disposed = vi.fn(async () => {});

    const agent = fragola.agent({ name: "dispose-agent-3", instructions: "", description: "" });

    agent.use(async () => {
      await Promise.resolve();
      await gate.promise;
      return disposed;
    }, "in-flight");

    await Promise.resolve();

    await expect((agent as Record<string, any>)["dispose"]()).resolves.toBeUndefined();
    expect(agent.hasHook("in-flight")).toBe(false);

    gate.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(disposed).not.toHaveBeenCalled();
    expect(agent.hasHook("in-flight")).toBe(false);
  });
});
