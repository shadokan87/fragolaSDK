/**
 * Tests for the modelInvocation event trio:
 *   before:modelInvocation → modelInvocation → after:modelInvocation
 */
import { describe, it, expect, vi } from "vitest";
import type OpenAI from "openai";
import type { AgentAny } from "@fragola-ai/agent/agent";
import { skip } from "@fragola-ai/agent/event";
import { injectReply } from "../injectReply";
import { createTestClient } from "./createTestClient";

const fragola = createTestClient();
type ModelInvocationHandler = Parameters<AgentAny["onModelInvocation"]>[0];

const createChunk = ({
    id,
    content,
    model = "test-model",
    role,
    finishReason = null,
}: {
    id: string,
    content?: string,
    model?: string,
    role?: "assistant",
    finishReason?: OpenAI.Chat.Completions.ChatCompletionChunk.Choice["finish_reason"],
}): OpenAI.ChatCompletionChunk => ({
    id,
    object: "chat.completion.chunk",
    created: 1,
    model,
    choices: [{
        index: 0,
        delta: {
            ...(role ? { role } : {}),
            ...(content !== undefined ? { content } : {}),
        },
        finish_reason: finishReason,
        logprobs: null,
    }],
});

const createChunkStream = (chunks: OpenAI.ChatCompletionChunk[]) => (async function* () {
    for (const chunk of chunks)
        yield chunk;
})();

const injectChunkStream = (agent: AgentAny, chunks: OpenAI.ChatCompletionChunk[]) => {
    agent.onBeforeModelInvocation(() => ({
        injectResponse: (() => createChunkStream(chunks) as any) as any,
    }));
};
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
// modelInvocation (streaming chunks)
// ─────────────────────────────────────────────────────────────────────────────

describe("modelInvocation — streaming chunk events", () => {
    it("fires chunk events; skip on a chunk passes it through unchanged", async () => {
        const agent = fragola.agent({
            name: "a",
            instructions: "You are a helpful assistant.",
            description: "",
        });
        injectChunkStream(agent, [
            createChunk({ id: "chunk-1", role: "assistant", content: "say" }),
            createChunk({ id: "chunk-2", content: " hi" }),
            createChunk({ id: "chunk-3", finishReason: "stop" }),
        ]);

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
        });
        injectChunkStream(agent, [
            createChunk({ id: "chunk-1", role: "assistant", content: "one" }),
            createChunk({ id: "chunk-2", content: " two" }),
            createChunk({ id: "chunk-3", content: " three" }),
            createChunk({ id: "chunk-4", finishReason: "stop" }),
        ]);

        let chunksBeforeStop = 0;
        agent.onModelInvocation((invocation, ctx) => {
            chunksBeforeStop++;
            if (invocation.kind !== "chunk")
                return invocation.data;
            if (chunksBeforeStop >= 2)
                return ctx.stop();
            return invocation.chunk;
        });

        const state = await agent.userMessage({ content: "count from 1 to 100" });
        const aiContent = state.messages.find((m) => m.role === "assistant")?.content;

        expect(chunksBeforeStop).toBe(2);
        expect(aiContent).toBe("one");
    });

    it("modelInvocation handlers can merge delta patches without rebuilding the chunk", async () => {
        const agent = fragola.agent({
            name: "a",
            instructions: "You are a helpful assistant.",
            description: "",
        });
        injectChunkStream(agent, [
            createChunk({ id: "chunk-1", role: "assistant", content: "hello" }),
            createChunk({ id: "chunk-2", content: " world" }),
            createChunk({ id: "chunk-3", finishReason: "stop" }),
        ]);

        const makeHandler = (suffix: string): ModelInvocationHandler => (invocation) => {
            if (invocation.kind !== "chunk")
                return invocation.data;
            if (!invocation.delta?.content)
                return invocation.chunk;
            return {
                injectDelta: {
                    content: invocation.delta.content + suffix,
                },
            };
        };

        agent.onModelInvocation(makeHandler("A"));
        agent.onModelInvocation(makeHandler("B"));
        agent.onModelInvocation(makeHandler("C"));

        const state = await agent.userMessage({ content: "say hello" });
        const aiContent = state.messages.find((m) => m.role === "assistant")?.content ?? "";
        expect(aiContent).toBe("helloABC worldABC");
    });

    it("modelInvocation handlers can merge into the full chunk between handlers", async () => {
        const agent = fragola.agent({
            name: "a",
            instructions: "You are a helpful assistant.",
            description: "",
        });
        injectChunkStream(agent, [
            createChunk({ id: "chunk-1", role: "assistant", content: "hello" }),
            createChunk({ id: "chunk-2", finishReason: "stop" }),
        ]);

        const seenModels: string[] = [];

        agent.onModelInvocation((invocation) => {
            if (invocation.kind !== "chunk")
                return invocation.data;
            return {
                injectChunk: {
                    model: "patched-model",
                },
            };
        });
        agent.onModelInvocation((invocation) => {
            if (invocation.kind !== "chunk")
                return invocation.data;
            seenModels.push(invocation.chunk.model);
            return invocation.chunk;
        });

        await agent.userMessage({ content: "say hello" });
        expect(seenModels).toEqual(["patched-model", "patched-model"]);
    });

    it("modelInvocation handlers can replace the primary choice when merge is false", async () => {
        const agent = fragola.agent({
            name: "a",
            instructions: "You are a helpful assistant.",
            description: "",
        });
        injectChunkStream(agent, [
            createChunk({ id: "chunk-1", role: "assistant", content: "base" }),
            createChunk({ id: "chunk-2", finishReason: "stop" }),
        ]);

        let replaced = false;
        agent.onModelInvocation((invocation) => {
            if (invocation.kind !== "chunk")
                return invocation.data;
            if (replaced || !invocation.delta?.content)
                return invocation.chunk;
            replaced = true;
            return {
                injectPrimary: {
                    index: 0,
                    delta: {
                        role: "assistant",
                        content: "replaced",
                    },
                    finish_reason: null,
                    logprobs: null,
                },
                merge: false,
            };
        });

        const state = await agent.userMessage({ content: "say hello" });
        const aiContent = state.messages.find((m) => m.role === "assistant")?.content;
        expect(aiContent).toBe("replaced");
    });

    it("a pipeline can merge injectDelta, injectPrimary, and injectChunk on the same chunk", async () => {
        const agent = fragola.agent({
            name: "a",
            instructions: "You are a helpful assistant.",
            description: "",
        });
        injectChunkStream(agent, [
            createChunk({ id: "chunk-1", role: "assistant", content: "alpha" }),
            createChunk({ id: "chunk-2", finishReason: "stop" }),
        ]);

        const snapshots: string[] = [];

        agent.onModelInvocation((invocation) => {
            if (invocation.kind !== "chunk")
                return invocation.data;
            if (!invocation.delta?.content)
                return invocation.chunk;
            return {
                injectDelta: {
                    content: invocation.delta.content + "!",
                },
            };
        });
        agent.onModelInvocation((invocation) => {
            if (invocation.kind !== "chunk")
                return invocation.data;
            if (!invocation.delta?.content)
                return invocation.chunk;
            return {
                injectPrimary: {
                    finish_reason: "length",
                },
            };
        });
        agent.onModelInvocation((invocation) => {
            if (invocation.kind !== "chunk")
                return invocation.data;
            if (!invocation.delta?.content)
                return invocation.chunk;
            return {
                injectChunk: {
                    model: "merged-model",
                },
            };
        });
        agent.onModelInvocation((invocation) => {
            if (invocation.kind !== "chunk")
                return invocation.data;
            if (invocation.delta?.content)
                snapshots.push(`${invocation.chunk.model}:${invocation.primaryChoice?.finish_reason}:${invocation.delta.content}`);
            return invocation.chunk;
        });

        const state = await agent.userMessage({ content: "say alpha" });
        const aiContent = state.messages.find((m) => m.role === "assistant")?.content;

        expect(snapshots).toEqual(["merged-model:length:alpha!"]);
        expect(aiContent).toBe("alpha!");
    });

    it("a pipeline can replace delta, primary choice, and then the full chunk", async () => {
        const agent = fragola.agent({
            name: "a",
            instructions: "You are a helpful assistant.",
            description: "",
        });
        injectChunkStream(agent, [
            createChunk({ id: "chunk-1", role: "assistant", content: "base" }),
            createChunk({ id: "chunk-2", content: " tail" }),
            createChunk({ id: "chunk-3", finishReason: "stop" }),
        ]);

        const snapshots: string[] = [];

        agent.onModelInvocation((invocation) => {
            if (invocation.kind !== "chunk")
                return invocation.data;
            if (invocation.delta?.content !== "base")
                return invocation.chunk;
            return {
                injectDelta: {
                    role: "assistant",
                    content: "delta-replaced",
                },
                merge: false,
            };
        });
        agent.onModelInvocation((invocation) => {
            if (invocation.kind !== "chunk")
                return invocation.data;
            if (invocation.delta?.content !== "delta-replaced")
                return invocation.chunk;
            snapshots.push(`delta:${invocation.delta.content}`);
            return {
                injectPrimary: {
                    index: 0,
                    delta: {
                        role: "assistant",
                        content: "primary-replaced",
                    },
                    finish_reason: null,
                    logprobs: null,
                },
                merge: false,
            };
        });
        agent.onModelInvocation((invocation) => {
            if (invocation.kind !== "chunk")
                return invocation.data;
            if (invocation.delta?.content !== "primary-replaced")
                return invocation.chunk;
            snapshots.push(`primary:${invocation.primaryChoice?.delta?.content}`);
            return {
                injectChunk: createChunk({
                    id: "chunk-1-replaced",
                    model: "replaced-model",
                    role: "assistant",
                    content: "chunk-replaced",
                }),
                merge: false,
            };
        });
        agent.onModelInvocation((invocation) => {
            if (invocation.kind !== "chunk")
                return invocation.data;
            if (invocation.delta?.content === "chunk-replaced")
                snapshots.push(`chunk:${invocation.chunk.model}:${invocation.delta.content}`);
            return invocation.chunk;
        });

        const state = await agent.userMessage({ content: "say base" });
        const aiContent = state.messages.find((m) => m.role === "assistant")?.content;

        expect(snapshots).toEqual([
            "delta:delta-replaced",
            "primary:primary-replaced",
            "chunk:replaced-model:chunk-replaced",
        ]);
        expect(aiContent).toBe("chunk-replaced tail");
    });

    it("later merge handlers see data produced by earlier replace handlers", async () => {
        const agent = fragola.agent({
            name: "a",
            instructions: "You are a helpful assistant.",
            description: "",
        });
        injectChunkStream(agent, [
            createChunk({ id: "chunk-1", role: "assistant", content: "start" }),
            createChunk({ id: "chunk-2", finishReason: "stop" }),
        ]);

        const snapshots: string[] = [];

        agent.onModelInvocation((invocation) => {
            if (invocation.kind !== "chunk")
                return invocation.data;
            if (invocation.delta?.content !== "start")
                return invocation.chunk;
            return {
                injectChunk: createChunk({
                    id: "chunk-replaced",
                    model: "phase-model",
                    role: "assistant",
                    content: "phase",
                }),
                merge: false,
            };
        });
        agent.onModelInvocation((invocation) => {
            if (invocation.kind !== "chunk")
                return invocation.data;
            if (invocation.delta?.content !== "phase")
                return invocation.chunk;
            snapshots.push(`after-replace:${invocation.chunk.id}:${invocation.chunk.model}:${invocation.delta.content}`);
            return {
                injectPrimary: {
                    finish_reason: "length",
                },
            };
        });
        agent.onModelInvocation((invocation) => {
            if (invocation.kind !== "chunk")
                return invocation.data;
            if (invocation.delta?.content !== "phase")
                return invocation.chunk;
            return {
                injectDelta: {
                    content: invocation.delta.content + "-done",
                },
            };
        });
        agent.onModelInvocation((invocation) => {
            if (invocation.kind !== "chunk")
                return invocation.data;
            if (invocation.delta?.content === "phase-done")
                snapshots.push(`after-merge:${invocation.chunk.id}:${invocation.primaryChoice?.finish_reason}:${invocation.delta.content}`);
            return invocation.chunk;
        });

        const state = await agent.userMessage({ content: "say start" });
        const aiContent = state.messages.find((m) => m.role === "assistant")?.content;

        expect(snapshots).toEqual([
            "after-replace:chunk-replaced:phase-model:phase",
            "after-merge:chunk-replaced:length:phase-done",
        ]);
        expect(aiContent).toBe("phase-done");
    });
});
