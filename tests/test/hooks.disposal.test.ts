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
        await expect(agent.removeHook("tracked")).resolves.toBe(true);

        expect(dispose).toHaveBeenCalledTimes(1);
        expect(agent.hasHook("tracked")).toBe(false);
        await expect(agent.removeHook("tracked")).resolves.toBe(false);
    });

    it("keeps named hooks removable when they do not return a disposer", async () => {
        const initialized = vi.fn();
        const agent = fragola.agent({ ...baseAgentOptions }).use(() => {
            initialized();
        }, "no-dispose");

        await expect(agent.removeHook("no-dispose")).resolves.toBe(true);

        expect(initialized).toHaveBeenCalledTimes(1);
        expect(agent.hasHook("no-dispose")).toBe(false);
        await expect(agent.removeHook("no-dispose")).resolves.toBe(false);
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
        const removalPromise = agent.removeHook("delayed").then((result) => {
            finished = true;
            return result;
        });

        await Promise.resolve();
        expect(finished).toBe(false);

        gate.resolve();
        await expect(removalPromise).resolves.toBe(true);

        expect(order).toEqual(["init:start", "init:done", "dispose"]);
        expect(agent.hasHook("delayed")).toBe(false);
    });
});