/**
 * Tests for the Fragola-level agentCreated event.
 */
import { describe, it, expect, vi } from "vitest";
import { createTestClient, defaultOpts } from "./createTestClient";

const baseAgentOptions = {
    name: "a",
    instructions: "",
    description: "",
};

const createDeferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((resolvePromise) => {
        resolve = resolvePromise;
    });

    return { promise, resolve };
};

// ─────────────────────────────────────────────────────────────────────────────
// agentCreated — callback behavior
// ─────────────────────────────────────────────────────────────────────────────

describe("agentCreated — callback behavior", () => {
    it("is called once for each newly created agent and receives that instance", () => {
        const createdAgents: unknown[] = [];
        const onCreated = vi.fn((agent) => {
            createdAgents.push(agent);
        });

        const fragola = createTestClient({
            ...defaultOpts,
            events: { agentCreated: onCreated },
        });

        const first = fragola.agent({ ...baseAgentOptions, name: "first" });
        const second = fragola.agent({ ...baseAgentOptions, name: "second" });

        expect(onCreated).toHaveBeenCalledTimes(2);
        expect(createdAgents).toEqual([first, second]);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// agentCreated — agent setup
// ─────────────────────────────────────────────────────────────────────────────

describe("agentCreated — agent setup", () => {
    it("can synchronously configure the created agent before its first turn", async () => {
        const fragola = createTestClient({
            ...defaultOpts,
            events: {
                agentCreated: (agent) => {
                    agent.onBeforeModelInvocation(() => ({
                        injectMessage: { content: "(created)" },
                    }));
                },
            },
        });

        const agent = fragola.agent({ ...baseAgentOptions });
        const state = await agent.userMessage({ content: "hi" });
        const assistantMessage = state.messages.find((message) => message.role === "assistant");

        expect(assistantMessage?.content).toBe("(created)");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// agentCreated — async setup
// ─────────────────────────────────────────────────────────────────────────────

describe("agentCreated — async setup", () => {
    it("does not block immediate agent usage while async setup is still pending", async () => {
        const gate = createDeferred();
        let started = false;
        let finished = false;

        const fragola = createTestClient({
            ...defaultOpts,
            events: {
                agentCreated: async (agent) => {
                    started = true;
                    agent.onBeforeModelInvocation(() => ({
                        injectMessage: { content: "(async-created)" },
                    }));
                    await gate.promise;
                    finished = true;
                },
            },
        });

        const agent = fragola.agent({ ...baseAgentOptions });

        expect(started).toBe(true);
        expect(finished).toBe(false);

        const state = await agent.userMessage({ content: "hi" });
        const assistantMessage = state.messages.find((message) => message.role === "assistant");

        expect(assistantMessage?.content).toBe("(async-created)");

        gate.resolve();
        await vi.waitFor(() => {
            expect(finished).toBe(true);
        });
    });
});