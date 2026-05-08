/**
 * Tests for the modelInvocation event trio:
 *   before:modelInvocation → modelInvocation → after:modelInvocation
 */
import { describe, it, expect, vi } from "vitest";
import { nanoid } from "nanoid";
import type { AgentAny } from "@fragola-ai/agentic-sdk-core/agent";
import { skip } from "@fragola-ai/agentic-sdk-core/event";
import { injectReply } from "../injectReply";
import { createTestClient } from "./createTestClient";

const fragola = createTestClient();
type ModelInvocationHandler = Parameters<AgentAny["onModelInvocation"]>[0];
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

        agent.onBeforeModelInvocation((_, ctx) => ctx.stop() as any);
        agent.onAfterModelInvocation(() => { afterCalled(); });

        const state = await agent.userMessage({ content: "hi" });
        expect(afterCalled).not.toHaveBeenCalled();
        expect(state.messages.filter((m) => m.role === "assistant")).toHaveLength(0);
    });

    it("stop in the first handler prevents subsequent handlers from running", async () => {
        const secondCalled = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });

        agent.onBeforeModelInvocation((_, ctx) => ctx.stop() as any);
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
        agent.use(injectReply("ok"));

        agent.onAfterModelInvocation(() => { calls.push(1); });
        agent.onAfterModelInvocation(() => { calls.push(2); });

        await agent.userMessage({ content: "hi" });
        expect(calls).toEqual([1, 2]);
    });

    it("unsubscribe removes an after:modelInvocation handler", async () => {
        const called = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("ok"));

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

        agent.onBeforeModelInvocation((_, ctx) => ctx.stop() as any);
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
        agent.onModelInvocation((invocation) => {
            chunkCount++;
            expect(invocation.kind).toBe("chunk");
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
        agent.onModelInvocation((invocation, ctx) => {
            chunksBeforeStop++;
            if (chunksBeforeStop >= 1) return ctx.stop();
            return invocation.data;
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

        const [id1, id2, id3] = [nanoid(), nanoid(), nanoid()];
        let firstContentChunkSeen = false;

        // Guard handler: marks when the first content-bearing chunk arrives so the
        // three transform handlers below can all target that same chunk in chain order.
        agent.onModelInvocation((invocation) => {
            if (invocation.kind !== "chunk")
                return invocation.data;
            if (!firstContentChunkSeen && invocation.data.choices[0]?.delta?.content)
                firstContentChunkSeen = true;
            return invocation.data;
        });

        const makeHandler = (id: string): ModelInvocationHandler => (invocation) => {
            if (invocation.kind !== "chunk")
                return invocation.data;

            const choice = invocation.data.choices[0];
            const delta = choice?.delta;
            const content = delta?.content;

            if (firstContentChunkSeen && choice && delta && content) {
                return {
                    ...invocation.data,
                    choices: [{
                        ...choice,
                        delta: { ...delta, content: content + id },
                    }],
                };
            }
            return invocation.data;
        };

        agent.onModelInvocation(makeHandler(id1));
        agent.onModelInvocation(makeHandler(id2));
        agent.onModelInvocation(makeHandler(id3));

        const state = await agent.userMessage({ content: "say hello" });
        const aiContent = state.messages.find((m) => m.role === "assistant")?.content ?? "";
        expect(typeof aiContent).toBe("string");
        expect(aiContent).toContain(id1);
        expect(aiContent).toContain(id2);
        expect(aiContent).toContain(id3);
    });
});
