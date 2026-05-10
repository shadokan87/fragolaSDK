/**
 * Tests for the aiMessage event.
 *
 * Non-streaming tests avoid real API calls by injecting assistant replies via
 * before:modelInvocation.
 */
import { describe, it, expect, vi } from "vitest";
import { skip } from "@fragola-ai/agentic-sdk-core/event";
import { injectReply } from "../injectReply";
import { createTestClient } from "./createTestClient";

const fragola = createTestClient();

// ─────────────────────────────────────────────────────────────────────────────
// aiMessage — non-streaming completions
// ─────────────────────────────────────────────────────────────────────────────

describe("aiMessage — non-streaming completions", () => {
    it("is called once with the final message, finish_reason, and usage", async () => {
        let callCount = 0;
        let receivedContent: string | null | undefined;
        let receivedFinishReason: string | null | undefined;
        let receivedUsage: unknown;
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("result"));

        agent.onAiMessage((message, finishReason, usage) => {
            callCount++;
            receivedContent = typeof message.content === "string" ? message.content : null;
            receivedFinishReason = finishReason;
            receivedUsage = usage;
            return message;
        });

        await agent.userMessage({ content: "hi" });
        expect(callCount).toBe(1);
        expect(receivedContent).toBe("result");
        expect(receivedFinishReason).toBe("stop");
        expect(receivedUsage).toBeUndefined();
    });

    it("multiple aiMessage handlers chain: each receives the previous message", async () => {
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("base"));

        agent.onAiMessage((message) => ({
            ...message,
            content: typeof message.content === "string" ? `${message.content}+A` : message.content,
        }));
        agent.onAiMessage((message) => ({
            ...message,
            content: typeof message.content === "string" ? `${message.content}+B` : message.content,
        }));
        agent.onAiMessage((message) => ({
            ...message,
            content: typeof message.content === "string" ? `${message.content}+C` : message.content,
        }));

        const state = await agent.userMessage({ content: "hi" });
        const aiMessage = state.messages.find((message) => message.role === "assistant");
        expect(aiMessage?.content).toBe("base+A+B+C");
    });

    it("unsubscribe removes an aiMessage handler", async () => {
        const called = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("ok"));

        const off = agent.onAiMessage((message) => {
            called();
            return message;
        });
        off();

        await agent.userMessage({ content: "hi" });
        expect(called).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// aiMessage — skip and stop
// ─────────────────────────────────────────────────────────────────────────────

describe("aiMessage — skip and stop", () => {
    it("skip keeps the current assistant message and passes control to the next handler", async () => {
        const order: number[] = [];
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("base"));

        agent.onAiMessage(() => { order.push(1); return skip() as any; });
        agent.onAiMessage((message) => {
            order.push(2);
            return {
                ...message,
                content: typeof message.content === "string" ? `${message.content}+next` : message.content,
            };
        });

        const state = await agent.userMessage({ content: "hi" });
        const aiMessage = state.messages.find((message) => message.role === "assistant");
        expect(order).toEqual([1, 2]);
        expect(aiMessage?.content).toBe("base+next");
    });

    it("stop prevents the assistant message from being appended", async () => {
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("never-appended"));

        agent.onAiMessage((_message, _finishReason, _usage, ctx) => ctx.stop() as any);

        const state = await agent.userMessage({ content: "hi" });
        expect(state.stepCount).toBe(0);
        expect(state.messages.filter((message) => message.role === "assistant")).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// aiMessage — state connection
// ─────────────────────────────────────────────────────────────────────────────

describe("aiMessage — state connection", () => {
    it("the transformed aiMessage is what gets appended to agent state", async () => {
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("result"));

        agent.onAiMessage((message) => ({
            ...message,
            content: typeof message.content === "string" ? `${message.content}:checked` : message.content,
        }));

        const state = await agent.userMessage({ content: "hi" });
        const aiMessage = state.messages.find((message) => message.role === "assistant");
        expect(aiMessage?.content).toBe("result:checked");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// aiMessage — streaming partial messages (real API)
// ─────────────────────────────────────────────────────────────────────────────

describe("aiMessage — streaming partial messages (real API)", () => {
    it("fires for partial streamed assistant messages before the final chunk", async () => {
        const agent = fragola.agent({
            name: "a",
            instructions: "You are a helpful assistant.",
            description: "",
            modelSettings: { stream: true, max_tokens: 50 },
        });

        let partialCount = 0;
        let finalFinishReason: string | null | undefined;
        agent.onAiMessage((message, finishReason) => {
            if (finishReason === null && typeof message.content === "string" && message.content.length > 0)
                partialCount++;
            if (finishReason !== null)
                finalFinishReason = finishReason;
            return message;
        });

        await agent.userMessage({ content: "say hi" });
        expect(partialCount).toBeGreaterThan(0);
        expect(finalFinishReason).toBeTruthy();
    });
});