import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { tool } from "@fragola-ai/agent";
import type { AgentAny } from "@fragola-ai/agent/agent";
import { createStore } from "@fragola-ai/agent/store";
import { Hook } from "@fragola-ai/agent/hook";
import { createTestClient } from "./createTestClient";
import { injectReply } from "../injectReply";

const fragola = createTestClient();

const baseAgentOptions = {
    name: "fork-test",
    description: "fork regression tests",
    instructions: "You are a helpful assistant.",
};

const getLastContentByRole = (agent: AgentAny, role: string) => {
    const message = [...agent.state.messages].reverse().find((entry) => entry.role === role);
    return message && "content" in message ? message.content : undefined;
};

const waitForHookSetup = async (agent: AgentAny) => {
    await agent.removeHook("__missing_hook__");
};

const injectSingleToolCall = (agent: AgentAny, toolName: string, input: string) => {
    let callCount = 0;
    agent.onBeforeModelInvocation(() => {
        callCount++;
        if (callCount === 1) {
            return {
                injectMessage: {
                    content: null as any,
                    tool_calls: [
                        {
                            id: `tc_${toolName}_${input}`,
                            type: "function" as const,
                            function: {
                                name: toolName,
                                arguments: JSON.stringify({ input }),
                            },
                        },
                    ],
                },
            };
        }

        return { injectMessage: { content: "" } };
    });
};

const makeEchoTool = (name = "echo") => {
    const handlerSpy = vi.fn((params: { input: string }) => `handled:${params.input}`);
    return {
        handlerSpy,
        tool: tool({
            name,
            description: `${name} tool`,
            schema: z.object({ input: z.string() }),
            handler: handlerSpy,
        }),
    };
};

describe("fork", () => {
    it("clones local contexts, namespaced contexts, and scoped instructions without sharing mutable state", () => {
        const agent = fragola.agent({
            ...baseAgentOptions,
            store: createStore({ nested: { count: 1 } }, "local"),
        });
        agent.context.addStore(createStore({ nested: { count: 2 } }, "extra"));
        agent.context.setInstructions("scoped instruction", "scope:a");

        const fork = agent.fork();

        expect(fork.id).not.toBe(agent.id);
        expect(fork.forkOf).toBe(agent.id);
        expect(fork.context.getStore()?.namespace).toBe("local");
        expect(fork.context.getStore("extra")?.namespace).toBe("extra");
        expect(fork.context.instructions("scope:a")).toBe("scoped instruction");
        expect(fork.context.getStore()).not.toBe(agent.context.getStore());
        expect(fork.context.getStore("extra")).not.toBe(agent.context.getStore("extra"));

        agent.context.getStore<{ nested: { count: number } }>()!.update(() => ({ nested: { count: 10 } }));
        agent.context.getStore<{ nested: { count: number } }>("extra")!.update(() => ({ nested: { count: 20 } }));
        agent.context.setInstructions("original only", "scope:a");

        expect(fork.context.getStore<{ nested: { count: number } }>()!.value).toEqual({ nested: { count: 1 } });
        expect(fork.context.getStore<{ nested: { count: number } }>("extra")!.value).toEqual({ nested: { count: 2 } });
        expect(fork.context.instructions("scope:a")).toBe("scoped instruction");

        fork.context.getStore<{ nested: { count: number } }>()!.update(() => ({ nested: { count: 100 } }));
        fork.context.getStore<{ nested: { count: number } }>("extra")!.update(() => ({ nested: { count: 200 } }));
        fork.context.setInstructions("fork only", "scope:a");

        expect(agent.context.getStore<{ nested: { count: number } }>()!.value).toEqual({ nested: { count: 10 } });
        expect(agent.context.getStore<{ nested: { count: number } }>("extra")!.value).toEqual({ nested: { count: 20 } });
        expect(agent.context.instructions("scope:a")).toBe("original only");
    });

    it("forks the current state instead of resetting to the initial messages option", async () => {
        const agent = fragola.agent({
            ...baseAgentOptions,
            messages: [{ role: "assistant", content: "seed" }],
            stepOptions: { resetStepCountAfterUserMessage: false },
        });
        agent.use(injectReply("after-seed"));
        await waitForHookSetup(agent);

        await agent.userMessage({ content: "first" });
        const fork = agent.fork();

        expect(fork.state).not.toBe(agent.state);
        expect(fork.state.messages).not.toBe(agent.state.messages);
        expect(fork.state.messages).toEqual(agent.state.messages);
        expect(fork.state.messages.map((message) => message.role)).toEqual(["assistant", "user", "assistant"]);
        expect(getLastContentByRole(fork, "assistant")).toBe("after-seed");

        await agent.userMessage({ content: "second" });

        expect(agent.state.stepCount).toBe(2);
        expect(fork.state.stepCount).toBe(1);
        expect(fork.state.messages).toHaveLength(3);
        expect(getLastContentByRole(fork, "user")).toBe("first");
    });

    it("copies manual events to the fork and keeps later unsubscription isolated", async () => {
        const agent = fragola.agent({ ...baseAgentOptions });
        agent.use(injectReply("ok"));
        const off = agent.onUserMessage((message) => ({
            ...message,
            content: typeof message.content === "string" ? `${message.content}:manual` : message.content,
        }));
        await waitForHookSetup(agent);

        const fork = agent.fork();
        off();

        await agent.userMessage({ content: "original" });
        await fork.userMessage({ content: "forked" });

        expect(getLastContentByRole(agent, "user")).toBe("original");
        expect(getLastContentByRole(fork, "user")).toBe("forked:manual");
        expect(getLastContentByRole(agent, "assistant")).toBe("ok");
        expect(getLastContentByRole(fork, "assistant")).toBe("ok");
    });

    it("replays hook behavior on the fork without duplicating hook-registered events", async () => {
        const suffixHook = Hook((agent) => {
            agent.onUserMessage((message) => ({
                ...message,
                content: typeof message.content === "string" ? `${message.content}:hook` : message.content,
            }));
        });

        const agent = fragola.agent({ ...baseAgentOptions });
        agent.use(injectReply("ok"));
        agent.use(suffixHook, "suffix");
        await waitForHookSetup(agent);

        const fork = agent.fork();
        await waitForHookSetup(fork);

        await agent.userMessage({ content: "original" });
        await fork.userMessage({ content: "forked" });

        expect(getLastContentByRole(agent, "user")).toBe("original:hook");
        expect(getLastContentByRole(fork, "user")).toBe("forked:hook");
    });

    it("allows removing a named hook on the fork without affecting the original", async () => {
        const removableHook = Hook((agent) => {
            const off = agent.onUserMessage((message) => ({
                ...message,
                content: typeof message.content === "string" ? `${message.content}:tag` : message.content,
            }));
            return () => off();
        });

        const agent = fragola.agent({ ...baseAgentOptions });
        agent.use(injectReply("ok"));
        agent.use(removableHook, "tag");
        await waitForHookSetup(agent);

        const fork = agent.fork();
        await waitForHookSetup(fork);

        await expect(fork.removeHook("tag")).resolves.toBe(true);
        expect(fork.hasHook("tag")).toBe(false);
        expect(agent.hasHook("tag")).toBe(true);

        await agent.userMessage({ content: "original" });
        await fork.userMessage({ content: "forked" });

        expect(getLastContentByRole(agent, "user")).toBe("original:tag");
        expect(getLastContentByRole(fork, "user")).toBe("forked");
    });

    it("keeps tool definitions usable on both agents and isolates later tool list updates", async () => {
        const { tool: echoTool, handlerSpy } = makeEchoTool();
        const otherTool = tool({
            name: "other",
            description: "other tool",
            schema: z.object({ input: z.string() }),
            handler: (params: { input: string }) => `other:${params.input}`,
        });

        const agent = fragola.agent({
            ...baseAgentOptions,
            tools: [echoTool],
        });
        const fork = agent.fork();

        fork.context.updateTools((prev) => [...prev, otherTool]);

        expect(agent.options.tools?.map((entry) => entry.name)).toEqual(["echo"]);
        expect(fork.options.tools?.map((entry) => entry.name)).toEqual(["echo", "other"]);

        injectSingleToolCall(agent, "echo", "original");
        injectSingleToolCall(fork, "echo", "forked");

        await agent.userMessage({ content: "run original" });
        await fork.userMessage({ content: "run forked" });

        expect(handlerSpy).toHaveBeenCalledWith({ input: "original" }, expect.anything());
        expect(handlerSpy).toHaveBeenCalledWith({ input: "forked" }, expect.anything());
        expect(agent.state.messages.some((message) => message.role === "tool" && message.content === JSON.stringify({ success: true, data: "handled:original" }))).toBe(true);
        expect(fork.state.messages.some((message) => message.role === "tool" && message.content === JSON.stringify({ success: true, data: "handled:forked" }))).toBe(true);
    });
});