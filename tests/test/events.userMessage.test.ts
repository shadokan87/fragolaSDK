/**
 * Tests for the userMessage event.
 *
 * These tests avoid real API calls by injecting assistant replies via
 * before:modelInvocation.
 */
import { describe, it, expect, vi } from "vitest";
import { skip } from "@fragola-ai/agentic-sdk-core/event";
import { injectReply } from "../injectReply";
import { createTestClient, defaultOpts } from "./createTestClient";

const fragola = createTestClient({
    ...defaultOpts, events: {
        agentCreated: (agent) => {
            agent.onBeforeModelInvocation(() => {
                return {
                    injectMessage: {
                        content: "(injected)"
                    }
                }
            })
        }
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// userMessage — callback behavior
// ─────────────────────────────────────────────────────────────────────────────

describe("userMessage — callback behavior", () => {
    it("is called once with the pending user message before it is appended", async () => {
        let capturedRole: string | undefined;
        let capturedContent: string | null | undefined;
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("ok"));

        agent.onUserMessage((message) => {
            capturedRole = message.role;
            capturedContent = typeof message.content === "string" ? message.content : null;
            return message;
        });

        await agent.userMessage({ content: "hi" });
        expect(capturedRole).toBe("user");
        expect(capturedContent).toBe("hi");
    });

    it("multiple userMessage handlers chain: each receives the previous message", async () => {
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("ok"));

        agent.onUserMessage((message) => ({
            ...message,
            content: typeof message.content === "string" ? `${message.content}+A` : message.content,
        }));
        agent.onUserMessage((message) => ({
            ...message,
            content: typeof message.content === "string" ? `${message.content}+B` : message.content,
        }));
        agent.onUserMessage((message) => ({
            ...message,
            content: typeof message.content === "string" ? `${message.content}+C` : message.content,
        }));

        const state = await agent.userMessage({ content: "base" });
        const userMessage = state.messages.find((message) => message.role === "user");
        expect(userMessage?.content).toBe("base+A+B+C");
    });

    it("unsubscribe removes a userMessage handler", async () => {
        const called = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("ok"));

        const off = agent.onUserMessage((message) => {
            called();
            return message;
        });
        off();

        await agent.userMessage({ content: "hi" });
        expect(called).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// userMessage — skip and stop
// ─────────────────────────────────────────────────────────────────────────────

describe("userMessage — skip and stop", () => {
    it("skip keeps the current user message and passes control to the next handler", async () => {
        const order: number[] = [];
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("ok"));

        agent.onUserMessage(() => { order.push(1); return skip() as any; });
        agent.onUserMessage((message) => {
            order.push(2);
            return {
                ...message,
                content: typeof message.content === "string" ? `${message.content}+next` : message.content,
            };
        });

        const state = await agent.userMessage({ content: "base" });
        const userMessage = state.messages.find((message) => message.role === "user");
        expect(order).toEqual([1, 2]);
        expect(userMessage?.content).toBe("base+next");
    });

    it("stop prevents user message append and step execution", async () => {
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("never-used"));

        agent.onUserMessage((_message, ctx) => ctx.stop() as any);

        const state = await agent.userMessage({ content: "hi" });
        expect(state.stepCount).toBe(0);
        expect(state.messages).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// userMessage — state connection
// ─────────────────────────────────────────────────────────────────────────────

describe("userMessage — state connection", () => {
    it("the transformed userMessage is what gets appended to agent state", async () => {
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("ok"));

        agent.onUserMessage((message) => ({
            ...message,
            content: typeof message.content === "string" ? `${message.content}:checked` : message.content,
        }));

        const state = await agent.userMessage({ content: "hi" });
        const userMessage = state.messages.find((message) => message.role === "user");
        expect(userMessage?.content).toBe("hi:checked");
    });
});