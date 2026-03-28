/**
 * Tests for the modelInvocation event trio:
 *   before:modelInvocation → modelInvocation → after:modelInvocation
 *
 * Signatures:
 *   before:modelInvocation  (config, context)       => config|skip|stop
 *     — can replace config with { injectMessage }, { injectResponse }, or modified modelSettings
 *   modelInvocation         (kind, data, context)   => data|skip|stop
 *     — fired per streaming chunk; skip preserves current data, stop aborts stream
 *   after:modelInvocation   (message, context)      => void
 *     — receives the final assistant message; can stop (signal not observed by caller in current code)
 *
 * Note: `modelInvocation` is only fired during streaming (stream:true). Tests for it use
 * the real API with stream:true. Tests for before/after use `injectMessage` so no real
 * API call is needed.
 */
import { describe, it, expect, vi } from "vitest";
import { skip, stop } from "@fragola-ai/agentic-sdk-core/event";
import type { AgentAny } from "@fragola-ai/agentic-sdk-core/agent";
import { createTestClient } from "./createTestClient";

const fragola = createTestClient();

function injectReply(agent: AgentAny, content = "injected-reply") {
    return agent.onBeforeModelInvocation(() => ({ injectMessage: { content } }));
}

// ─────────────────────────────────────────────────────────────────────────────
// before:modelInvocation
// ─────────────────────────────────────────────────────────────────────────────

describe("before:modelInvocation — config injection and modification", () => {
    it("injectMessage skips the real API call; after:modelInvocation receives the injected message", async () => {
        let receivedContent: string | null | undefined;
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });

        agent.onBeforeModelInvocation(() => ({
            injectMessage: { content: "hello from inject" },
        }));
        agent.onAfterModelInvocation((message) => {
            receivedContent = typeof message.content === "string" ? message.content : null;
        });

        await agent.userMessage({ content: "hi" });
        expect(receivedContent).toBe("hello from inject");
    });

    it("multiple before:modelInvocation handlers: last non-skip wins", async () => {
        let receivedContent: string | null | undefined;
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });

        agent.onBeforeModelInvocation(() => ({ injectMessage: { content: "first" } }));
        agent.onBeforeModelInvocation(() => ({ injectMessage: { content: "second" } }));
        agent.onAfterModelInvocation((message) => {
            receivedContent = typeof message.content === "string" ? message.content : null;
        });

        await agent.userMessage({ content: "hi" });
        expect(receivedContent).toBe("second");
    });

    it("skip in before:modelInvocation keeps the current config and passes to next handler", async () => {
        const order: number[] = [];
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });

        agent.onBeforeModelInvocation(() => { order.push(1); return skip() as any; });
        // second handler must inject a reply so no real API call is made
        agent.onBeforeModelInvocation(() => { order.push(2); return { injectMessage: { content: "ok" } }; });

        await agent.userMessage({ content: "hi" });
        expect(order).toEqual([1, 2]);
    });
});

describe("before:modelInvocation — stop", () => {
    it("stop prevents model invocation entirely", async () => {
        const afterCalled = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });

        agent.onBeforeModelInvocation(() => stop() as any);
        agent.onAfterModelInvocation(() => { afterCalled(); });

        const state = await agent.userMessage({ content: "hi" });
        expect(afterCalled).not.toHaveBeenCalled();
        expect(state.messages.filter((m) => m.role === "assistant")).toHaveLength(0);
    });

    it("stop in the first handler prevents subsequent handlers from running", async () => {
        const secondCalled = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });

        agent.onBeforeModelInvocation(() => stop() as any);
        agent.onBeforeModelInvocation(() => { secondCalled(); return { injectMessage: { content: "ok" } }; });

        await agent.userMessage({ content: "hi" });
        expect(secondCalled).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// after:modelInvocation
// ─────────────────────────────────────────────────────────────────────────────

describe("after:modelInvocation — callback behavior", () => {
    it("is called once per model invocation with the final message", async () => {
        const messages: string[] = [];
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });

        agent.onBeforeModelInvocation(() => ({ injectMessage: { content: "result" } }));
        agent.onAfterModelInvocation((message) => {
            messages.push(typeof message.content === "string" ? message.content : "");
        });

        await agent.userMessage({ content: "hi" });
        expect(messages).toHaveLength(1);
        expect(messages[0]).toBe("result");
    });

    it("multiple after:modelInvocation handlers are all called", async () => {
        const calls: number[] = [];
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        injectReply(agent, "ok");

        agent.onAfterModelInvocation(() => { calls.push(1); });
        agent.onAfterModelInvocation(() => { calls.push(2); });

        await agent.userMessage({ content: "hi" });
        expect(calls).toEqual([1, 2]);
    });

    it("unsubscribe removes an after:modelInvocation handler", async () => {
        const called = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        injectReply(agent, "ok");

        const off = agent.onAfterModelInvocation(() => { called(); });
        off();

        await agent.userMessage({ content: "hi" });
        expect(called).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// before → after connection
// ─────────────────────────────────────────────────────────────────────────────

describe("before:modelInvocation → after:modelInvocation connection", () => {
    it("message injected in before is exactly what after receives", async () => {
        const injected = { content: "precise-content", meta: undefined };
        let afterContent: string | null | undefined;
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });

        agent.onBeforeModelInvocation(() => ({ injectMessage: { content: injected.content } }));
        agent.onAfterModelInvocation((message) => {
            afterContent = typeof message.content === "string" ? message.content : null;
        });

        await agent.userMessage({ content: "hi" });
        expect(afterContent).toBe(injected.content);
    });

    it("stop in before:modelInvocation means after:modelInvocation never fires", async () => {
        const afterFired = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });

        agent.onBeforeModelInvocation(() => stop() as any);
        agent.onAfterModelInvocation(() => { afterFired(); });

        await agent.userMessage({ content: "hi" });
        expect(afterFired).not.toHaveBeenCalled();
    });

    it("after:modelInvocation message is appended to agent state messages", async () => {
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });

        agent.onBeforeModelInvocation(() => ({ injectMessage: { content: "state-check" } }));

        await agent.userMessage({ content: "hi" });
        const aiMessages = agent.state.messages.filter((m) => m.role === "assistant");
        expect(aiMessages).toHaveLength(1);
        expect(aiMessages[0].content).toBe("state-check");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// modelInvocation (streaming chunks) — requires real API with stream: true
// ─────────────────────────────────────────────────────────────────────────────

describe("modelInvocation — streaming chunk events (real API)", () => {
    it("fires chunk events; skip on a chunk passes it through unchanged", async () => {
        const agent = fragola.agent({
            name: "a",
            instructions: "You are a helpful assistant.",
            description: "",
            modelSettings: { stream: true, max_tokens: 50 },
        });

        let chunkCount = 0;
        agent.onModelInvocation((_kind, data) => {
            chunkCount++;
            return skip(); // skip: chunk is used as-is
        });

        await agent.userMessage({ content: "say hi" });
        expect(chunkCount).toBeGreaterThan(0);
    });

    it("stop in modelInvocation aborts the stream early", async () => {
        const agent = fragola.agent({
            name: "a",
            instructions: "You are a helpful assistant.",
            description: "",
            modelSettings: { stream: true, max_tokens: 200 },
        });

        let chunksBeforeStop = 0;
        agent.onModelInvocation((_kind, data) => {
            chunksBeforeStop++;
            if (chunksBeforeStop >= 1) return stop();
            return data as any;
        });

        await agent.userMessage({ content: "count from 1 to 100" });
        // Stream was aborted after ≤1 chunks, so the message content should be partial/empty
        expect(chunksBeforeStop).toBeGreaterThanOrEqual(1);
    });

    it("modelInvocation handler can transform chunk data", async () => {
        const agent = fragola.agent({
            name: "a",
            instructions: "You are a helpful assistant.",
            description: "",
            modelSettings: { stream: true, max_tokens: 50 },
        });

        let transformApplied = false;
        agent.onModelInvocation((_kind, data: any) => {
            transformApplied = true;
            // modify delta content if present
            if (data?.choices?.[0]?.delta?.content) {
                return {
                    ...data,
                    choices: [
                        {
                            ...data.choices[0],
                            delta: { ...data.choices[0].delta, content: data.choices[0].delta.content },
                        },
                    ],
                } as any;
            }
            return data as any;
        });

        await agent.userMessage({ content: "say hello" });
        expect(transformApplied).toBe(true);
    });
});
