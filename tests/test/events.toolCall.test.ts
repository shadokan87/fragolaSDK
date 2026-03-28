/**
 * Tests for the toolCall event trio:
 *   before:toolCall → toolCall → after:toolCall
 *
 * Signatures:
 *   before:toolCall  (params, tool, context) => void               — can stop only
 *   toolCall         (params, tool, context) => result|skip|stop   — can override tool result or skip to default handler
 *   after:toolCall   (result, params, tool, context) => void       — receives final tool result; can stop
 *
 * All tests inject an assistant message with tool_calls via before:modelInvocation
 * so no real API call is needed.
 */
import { describe, it, expect, vi } from "vitest";
import { skip, stop } from "@fragola-ai/agentic-sdk-core/event";
import type { AgentAny } from "@fragola-ai/agentic-sdk-core/agent";
import { tool } from "@fragola-ai/agentic-sdk-core";
import { z } from "zod";
import { createTestClient } from "./createTestClient";

const fragola = createTestClient();

const TOOL_CALL_ID = "call_test_001";

/** Injects a single tool call into the conversation (no real API call). */
function injectToolCall(
    agent: AgentAny,
    toolName: string,
    args: Record<string, unknown> = { input: "test-value" },
    callId = TOOL_CALL_ID,
) {
    return agent.onBeforeModelInvocation(() => ({
        injectMessage: {
            content: null,
            tool_calls: [
                {
                    id: callId,
                    type: "function" as const,
                    function: { name: toolName, arguments: JSON.stringify(args) },
                },
            ],
        },
    }));
}

/** A basic tool whose handler records calls so we can assert on it. */
function makeTestTool(name = "myTool") {
    const handlerSpy = vi.fn((_params: { input: string }) => `handler-result:${_params.input}`);
    const t = tool({
        name,
        description: "test tool",
        schema: z.object({ input: z.string() }),
        handler: handlerSpy,
    });
    return { tool: t, handlerSpy };
}

// ─────────────────────────────────────────────────────────────────────────────
// Invocation order
// ─────────────────────────────────────────────────────────────────────────────

describe("toolCall event trio — invocation order", () => {
    it("fires before:toolCall → toolCall → after:toolCall in order", async () => {
        const order: string[] = [];
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool");
        // After tool call the agent would try to generate again — inject a plain reply for that
        agent.onBeforeModelInvocation((_config) => {
            // Only inject plain reply on the second invocation (no tool_calls in message)
            return { injectMessage: { content: "done" } };
        });

        agent.onBeforeToolCall(() => { order.push("before"); });
        agent.onToolCall((_params, _tool) => { order.push("toolCall"); return skip(); });
        agent.onAfterToolCall(() => { order.push("after"); });

        await agent.userMessage({ content: "hi" });
        expect(order).toEqual(["before", "toolCall", "after"]);
    });

    it("all three handlers receive the tool and params", async () => {
        const seen: { stage: string; toolName: string; paramInput: string }[] = [];
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool", { input: "hello" });
        agent.onBeforeModelInvocation(() => ({ injectMessage: { content: "done" } }));

        agent.onBeforeToolCall((params, tool) => {
            seen.push({ stage: "before", toolName: tool.name, paramInput: params.input });
        });
        agent.onToolCall((params, tool) => {
            seen.push({ stage: "toolCall", toolName: tool.name, paramInput: params.input });
            return skip();
        });
        agent.onAfterToolCall((_result, params, tool) => {
            seen.push({ stage: "after", toolName: tool.name, paramInput: params.input });
        });

        await agent.userMessage({ content: "hi" });

        expect(seen).toHaveLength(3);
        seen.forEach((s) => {
            expect(s.toolName).toBe("myTool");
            expect(s.paramInput).toBe("hello");
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// skip
// ─────────────────────────────────────────────────────────────────────────────

describe("toolCall event trio — skip", () => {
    it("skip in toolCall falls back to the tool's default handler", async () => {
        const { tool: t, handlerSpy } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool", { input: "foo" });
        agent.onBeforeModelInvocation(() => ({ injectMessage: { content: "done" } }));

        agent.onToolCall(() => skip()); // skip → default handler runs

        await agent.userMessage({ content: "hi" });
        expect(handlerSpy).toHaveBeenCalledWith({ input: "foo" }, expect.anything());
    });

    it("skip in toolCall: after:toolCall receives the default-handler result", async () => {
        let afterResult: unknown;
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool", { input: "bar" });
        agent.onBeforeModelInvocation(() => ({ injectMessage: { content: "done" } }));

        agent.onToolCall(() => skip());
        agent.onAfterToolCall((result) => { afterResult = result; });

        await agent.userMessage({ content: "hi" });
        expect(afterResult).toBe("handler-result:bar");
    });

    it("multiple toolCall handlers: first non-skip result wins", async () => {
        let afterResult: unknown;
        const { tool: t, handlerSpy } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool");
        agent.onBeforeModelInvocation(() => ({ injectMessage: { content: "done" } }));

        agent.onToolCall(() => skip());              // skipped
        agent.onToolCall(() => "override-result");   // this wins
        agent.onAfterToolCall((result) => { afterResult = result; });

        await agent.userMessage({ content: "hi" });
        // handler should NOT have been called because second toolCall handler returned a result
        expect(handlerSpy).not.toHaveBeenCalled();
        expect(afterResult).toBe("override-result");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// stop
// ─────────────────────────────────────────────────────────────────────────────

describe("toolCall event trio — stop", () => {
    it("stop in before:toolCall prevents toolCall handler and default handler from running", async () => {
        const { tool: t, handlerSpy } = makeTestTool();
        const toolCallSpy = vi.fn();
        const afterSpy = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool");
        agent.onBeforeModelInvocation(() => ({ injectMessage: { content: "done" } }));

        agent.onBeforeToolCall(() => stop() as any);
        agent.onToolCall(() => { toolCallSpy(); return skip(); });
        agent.onAfterToolCall(() => { afterSpy(); });

        await agent.userMessage({ content: "hi" });
        expect(handlerSpy).not.toHaveBeenCalled();
        expect(toolCallSpy).not.toHaveBeenCalled();
        expect(afterSpy).not.toHaveBeenCalled();
    });

    it("stop in toolCall prevents default handler from running but after:toolCall is not called either", async () => {
        const { tool: t, handlerSpy } = makeTestTool();
        const afterSpy = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool");
        agent.onBeforeModelInvocation(() => ({ injectMessage: { content: "done" } }));

        agent.onToolCall(() => stop());
        agent.onAfterToolCall(() => { afterSpy(); });

        await agent.userMessage({ content: "hi" });
        expect(handlerSpy).not.toHaveBeenCalled();
        expect(afterSpy).not.toHaveBeenCalled();
    });

    it("stop in after:toolCall: tool message is still appended to state", async () => {
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool", { input: "x" });
        agent.onBeforeModelInvocation(() => ({ injectMessage: { content: "done" } }));

        agent.onAfterToolCall(() => stop() as any);

        await agent.userMessage({ content: "hi" });
        const toolMessages = agent.state.messages.filter((m) => m.role === "tool");
        expect(toolMessages).toHaveLength(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Connection: toolCall result flows into after:toolCall
// ─────────────────────────────────────────────────────────────────────────────

describe("toolCall event trio — connection: result flows from toolCall → after:toolCall", () => {
    it("custom result returned by toolCall is received by after:toolCall", async () => {
        let afterResult: unknown;
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool", { input: "ignored" });
        agent.onBeforeModelInvocation(() => ({ injectMessage: { content: "done" } }));

        agent.onToolCall(() => ({ custom: true, value: 123 }));
        agent.onAfterToolCall((result) => { afterResult = result; });

        await agent.userMessage({ content: "hi" });
        expect(afterResult).toEqual({ custom: true, value: 123 });
    });

    it("tool result is serialized and appended as a tool message in state", async () => {
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool", { input: "state-test" });
        agent.onBeforeModelInvocation(() => ({ injectMessage: { content: "done" } }));

        agent.onToolCall(() => ({ serialized: "yes" }));

        await agent.userMessage({ content: "hi" });
        const toolMsg = agent.state.messages.find((m) => m.role === "tool");
        expect(toolMsg).toBeDefined();
        expect(toolMsg?.content).toBe(JSON.stringify({ serialized: "yes" }));
    });

    it("default handler result (when toolCall skips) also propagates to after:toolCall", async () => {
        let afterResult: unknown;
        const { tool: t } = makeTestTool(); // handler returns "handler-result:<input>"
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool", { input: "propagate" });
        agent.onBeforeModelInvocation(() => ({ injectMessage: { content: "done" } }));

        agent.onToolCall(() => skip());
        agent.onAfterToolCall((result) => { afterResult = result; });

        await agent.userMessage({ content: "hi" });
        expect(afterResult).toBe("handler-result:propagate");
    });

    it("unsubscribe removes a toolCall handler", async () => {
        const { tool: t, handlerSpy } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool");
        agent.onBeforeModelInvocation(() => ({ injectMessage: { content: "done" } }));

        const off = agent.onToolCall(() => "override");
        off();

        await agent.userMessage({ content: "hi" });
        // After unsubscribe the override is gone, so default handler runs
        expect(handlerSpy).toHaveBeenCalled();
    });
});
