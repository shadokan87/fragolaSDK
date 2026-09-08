import { describe, expect, it, vi } from "vitest";
import { createTestClient } from "./createTestClient";

const fragola = createTestClient();

const baseAgentOptions = {
    name: "hook-test",
    description: "",
    instructions: "",
};

const createDeferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((resolvePromise) => {
        resolve = resolvePromise;
    });

    return { promise, resolve };
};

describe("hook disposal", () => {
    it("calls the named hook disposer and unregisters the hook", async () => {
        const dispose = vi.fn();
        const agent = fragola.agent({ ...baseAgentOptions }).use(() => dispose, "tracked");

        expect(agent.hasHook("tracked")).toBe(true);
        await agent.removeHook("tracked");

        expect(dispose).toHaveBeenCalledTimes(1);
        expect(agent.hasHook("tracked")).toBe(false);
    });

    it("treats pending named hooks as installed and waits for initialization before disposal", async () => {
        const gate = createDeferred();
        const order: string[] = [];
        const agent = fragola.agent({ ...baseAgentOptions }).use(async () => {
            order.push("init:start");
            await gate.promise;
            order.push("init:done");

            return async () => {
                order.push("dispose");
            };
        }, "delayed");

        expect(agent.hasHook("delayed")).toBe(true);

        let finished = false;
        const removalPromise = agent.removeHook("delayed").then(() => {
            finished = true;
        });

        await Promise.resolve();
        expect(finished).toBe(false);

        gate.resolve();
        await removalPromise;

        expect(order).toEqual(["init:start", "init:done", "dispose"]);
        expect(agent.hasHook("delayed")).toBe(false);
    });
});