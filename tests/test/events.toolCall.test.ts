/**
 * Tests for the toolCall event trio:
 *   before:toolCall → toolCall → after:toolCall
 * 
 * All tests avoid real API calls by injecting an assistant message that carries
 * tool_calls on the first model invocation, then a plain empty message on the
 * follow-up invocation (after the tool result message is appended).
 */
import { describe, it, expect, vi } from "vitest";
import { skip } from "@fragola-ai/agent/event";
import { tool } from "@fragola-ai/agent";
import { z } from "zod";
import type { AgentAny } from "@fragola-ai/agent/agent";
import { createTestClient } from "./createTestClient";

const fragola = createTestClient();

const TOOL_CALL_ID = "tc_test_001";

/** Injects a single tool call into the conversation (no real API call).
 *  On the first model invocation an assistant message with tool_calls is returned.
 *  On every subsequent invocation a plain empty message is returned to close the loop.
 */
function injectToolCall(
    agent: AgentAny,
    toolName: string,
    args: Record<string, unknown> = { input: "test-value" },
    callId = TOOL_CALL_ID,
) {
    let callCount = 0;
    agent.onBeforeModelInvocation(() => {
        callCount++;
        if (callCount === 1) {
            return {
                injectMessage: {
                    content: null as any,
                    tool_calls: [
                        {
                            id: callId,
                            type: "function" as const,
                            function: { name: toolName, arguments: JSON.stringify(args) },
                        },
                    ],
                },
            };
        }
        return { injectMessage: { content: "" } };
    });
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

const successPayload = (data: unknown) => ({ success: true as const, data });

const asPayload = (value: unknown) => value as {
    success: boolean;
    data?: unknown;
    error?: unknown;
};

// ─────────────────────────────────────────────────────────────────────────────
// before:toolCall
// ─────────────────────────────────────────────────────────────────────────────

describe("before:toolCall — injectConfig", () => {
    it("injectConfig bypasses the handler entirely", async () => {
        const { tool: t, handlerSpy } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool");

        agent.onBeforeToolCall(() => ({ injectConfig: successPayload("injected-result") }));

        await agent.userMessage({ content: "hi" });
        expect(handlerSpy).not.toHaveBeenCalled();
    });

    it("injectConfig is what after:toolCall receives", async () => {
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool");

        agent.onBeforeToolCall(() => ({ injectConfig: successPayload("from-before") }));

        let afterResult: unknown;
        agent.onAfterToolCall((result) => { afterResult = result; });

        await agent.userMessage({ content: "hi" });
        expect(afterResult).toEqual({ success: true, data: "from-before" });
    });

    it("multiple before:toolCall handlers: last non-skip wins", async () => {
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool");

        agent.onBeforeToolCall(() => ({ injectConfig: successPayload("first") }));
        agent.onBeforeToolCall(() => ({ injectConfig: successPayload("second") }));

        let afterResult: unknown;
        agent.onAfterToolCall((result) => { afterResult = result; });

        await agent.userMessage({ content: "hi" });
        expect(afterResult).toEqual({ success: true, data: "second" });
    });

    it("skip in before:toolCall keeps current config and passes to next handler", async () => {
        const order: number[] = [];
        const { tool: t, handlerSpy } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool");

        agent.onBeforeToolCall(() => { order.push(1); return skip() as any; });
        agent.onBeforeToolCall(() => { order.push(2); return { injectConfig: successPayload("skipped-then-injected") }; });

        await agent.userMessage({ content: "hi" });
        expect(order).toEqual([1, 2]);
        expect(handlerSpy).not.toHaveBeenCalled();
    });

    it("before:toolCall can modify params via { params: newParams }", async () => {
        const { tool: t, handlerSpy } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool", { input: "original" });

        agent.onBeforeToolCall(() => ({ params: { input: "modified" } }));

        await agent.userMessage({ content: "hi" });
        expect(handlerSpy).toHaveBeenCalledWith({ input: "modified" }, expect.anything());
    });
});

describe("before:toolCall — stop", () => {
    it("stop prevents the handler and all subsequent events from running", async () => {
        const { tool: t, handlerSpy } = makeTestTool();
        const toolCallFired = vi.fn();
        const afterFired = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool");

        agent.onBeforeToolCall((_config, _tool, ctx) => ctx.stop() as any);
        agent.onToolCall(() => { toolCallFired(); return skip(); });
        agent.onAfterToolCall(() => { afterFired(); });

        await agent.userMessage({ content: "hi" });
        expect(handlerSpy).not.toHaveBeenCalled();
        expect(toolCallFired).not.toHaveBeenCalled();
        expect(afterFired).not.toHaveBeenCalled();
    });

    it("stop in the first before:toolCall handler prevents subsequent before handlers", async () => {
        const secondCalled = vi.fn();
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool");

        agent.onBeforeToolCall((_config, _tool, ctx) => ctx.stop() as any);
        agent.onBeforeToolCall(() => { secondCalled(); return { injectConfig: successPayload("never") }; });

        await agent.userMessage({ content: "hi" });
        expect(secondCalled).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// toolCall
// ─────────────────────────────────────────────────────────────────────────────

describe("toolCall — handler runs automatically, event transforms result", () => {
    it("handler runs before toolCall fires; toolCall receives handler result", async () => {
        const { tool: t, handlerSpy } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool", { input: "x" });

        let receivedResult: unknown;
        agent.onToolCall((result) => { receivedResult = result; return result; });

        await agent.userMessage({ content: "hi" });
        expect(handlerSpy).toHaveBeenCalledWith({ input: "x" }, expect.anything());
        expect(receivedResult).toEqual({ success: true, data: "handler-result:x" });
    });

    it("toolCall can transform the result", async () => {
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool", { input: "x" });

        agent.onToolCall(() => ({ success: true, data: "transformed-result" }));

        let afterResult: unknown;
        agent.onAfterToolCall((result) => { afterResult = result; });

        await agent.userMessage({ content: "hi" });
        expect(afterResult).toEqual({ success: true, data: "transformed-result" });
    });

    it("skip in toolCall preserves the handler result unchanged", async () => {
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool", { input: "x" });

        agent.onToolCall(() => skip());

        let afterResult: unknown;
        agent.onAfterToolCall((result) => { afterResult = result; });

        await agent.userMessage({ content: "hi" });
        expect(afterResult).toEqual({ success: true, data: "handler-result:x" });
    });

    it("multiple toolCall handlers chain: each receives the previous result", async () => {
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool", { input: "x" });

        agent.onToolCall((result) => {
            const payload = asPayload(result);
            return payload.success ? { ...payload, data: `${payload.data}+A` } : payload;
        });
        agent.onToolCall((result) => {
            const payload = asPayload(result);
            return payload.success ? { ...payload, data: `${payload.data}+B` } : payload;
        });
        agent.onToolCall((result) => {
            const payload = asPayload(result);
            return payload.success ? { ...payload, data: `${payload.data}+C` } : payload;
        });

        let afterResult: unknown;
        agent.onAfterToolCall((result) => { afterResult = result; });

        await agent.userMessage({ content: "hi" });
        expect(afterResult).toEqual({ success: true, data: "handler-result:x+A+B+C" });
    });

    it("handler errors become failure payloads and do not reject the agent", async () => {
        const handlerSpy = vi.fn(() => {
            throw new Error("boom");
        });
        const failingTool = tool({
            name: "myTool",
            description: "test tool",
            schema: z.object({ input: z.string() }),
            handler: handlerSpy,
        });
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [failingTool] });
        injectToolCall(agent, "myTool", { input: "x" });

        let receivedResult: unknown;
        let afterResult: unknown;
        agent.onToolCall((result) => { receivedResult = result; return result; });
        agent.onAfterToolCall((result) => { afterResult = result; });

        await expect(agent.userMessage({ content: "hi" })).resolves.toBeDefined();

        expect(handlerSpy).toHaveBeenCalledWith({ input: "x" }, expect.anything());
        expect(receivedResult).toMatchObject({ success: false, error: expect.any(Error), data: "Arguments valid but tool call execution failed" });
        expect((receivedResult as { error: Error }).error.message).toBe("boom");
        expect(afterResult).toMatchObject({ success: false, error: expect.any(Error), data: "Arguments valid but tool call execution failed" });

        const toolMsg = agent.state.messages.find((m) => m.role === "tool");
        expect(toolMsg).toBeDefined();
        expect(String(toolMsg?.content)).toContain("Arguments valid but tool call execution failed");
    });

    it("stop in toolCall prevents further toolCall handlers and after:toolCall", async () => {
        const { tool: t } = makeTestTool();
        const secondCalled = vi.fn();
        const afterFired = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool");

        agent.onToolCall((_result, _params, _tool, ctx) => ctx.stop() as any);
        agent.onToolCall(() => { secondCalled(); return skip(); });
        agent.onAfterToolCall(() => { afterFired(); });

        await agent.userMessage({ content: "hi" });
        expect(secondCalled).not.toHaveBeenCalled();
        expect(afterFired).not.toHaveBeenCalled();
    });

    it("toolCall result (not handler's raw result) is what gets appended to messages", async () => {
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool", { input: "x" });

        agent.onToolCall(() => ({ success: true, data: "overridden-content" }));

        await agent.userMessage({ content: "hi" });
        const toolMsg = agent.state.messages.find((m) => m.role === "tool");
        expect(toolMsg).toBeDefined();
        expect(toolMsg?.content).toBe(JSON.stringify("overridden-content"));
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// after:toolCall
// ─────────────────────────────────────────────────────────────────────────────

describe("after:toolCall — callback behavior", () => {
    it("is called once per tool invocation with the final result", async () => {
        const results: unknown[] = [];
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool", { input: "z" });

        agent.onAfterToolCall((result) => { results.push(result); });

        await agent.userMessage({ content: "hi" });
        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({ success: true, data: "handler-result:z" });
    });

    it("multiple after:toolCall handlers are all called in order", async () => {
        const calls: number[] = [];
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool");

        agent.onAfterToolCall(() => { calls.push(1); });
        agent.onAfterToolCall(() => { calls.push(2); });
        agent.onAfterToolCall(() => { calls.push(3); });

        await agent.userMessage({ content: "hi" });
        expect(calls).toEqual([1, 2, 3]);
    });

    it("unsubscribe removes an after:toolCall handler", async () => {
        const called = vi.fn();
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool");

        const off = agent.onAfterToolCall(() => { called(); });
        off();

        await agent.userMessage({ content: "hi" });
        expect(called).not.toHaveBeenCalled();
    });

    it("receives both params and tool reference alongside result", async () => {
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool", { input: "w" });

        let capturedParams: unknown;
        let capturedToolName: string | undefined;
        agent.onAfterToolCall((result, params, tool) => {
            capturedParams = params;
            capturedToolName = tool.name;
        });

        await agent.userMessage({ content: "hi" });
        expect(capturedParams).toEqual({ input: "w" });
        expect(capturedToolName).toBe("myTool");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// before:toolCall → toolCall → after:toolCall connections
// ─────────────────────────────────────────────────────────────────────────────

describe("before:toolCall → toolCall → after:toolCall connections", () => {
    it("injectConfig in before means handler is not called and toolCall receives injected value", async () => {
        const { tool: t, handlerSpy } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool");

        agent.onBeforeToolCall(() => ({ injectConfig: successPayload("injected") }));

        let toolCallReceivedResult: unknown;
        agent.onToolCall((result) => { toolCallReceivedResult = result; return result; });

        await agent.userMessage({ content: "hi" });
        expect(handlerSpy).not.toHaveBeenCalled();
        expect(toolCallReceivedResult).toEqual({ success: true, data: "injected" });
    });

    it("handler result flows through toolCall transform into after:toolCall", async () => {
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool", { input: "flow" });

        agent.onToolCall((result) => {
            const payload = asPayload(result);
            return payload.success ? { ...payload, data: `${payload.data}:transformed` } : payload;
        });

        let afterResult: unknown;
        agent.onAfterToolCall((result) => { afterResult = result; });

        await agent.userMessage({ content: "hi" });
        expect(afterResult).toEqual({ success: true, data: "handler-result:flow:transformed" });
    });

    it("stop in before:toolCall means toolCall and after:toolCall never fire", async () => {
        const toolCallFired = vi.fn();
        const afterFired = vi.fn();
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool");

        agent.onBeforeToolCall((_config, _tool, ctx) => ctx.stop() as any);
        agent.onToolCall(() => { toolCallFired(); return skip(); });
        agent.onAfterToolCall(() => { afterFired(); });

        await agent.userMessage({ content: "hi" });
        expect(toolCallFired).not.toHaveBeenCalled();
        expect(afterFired).not.toHaveBeenCalled();
    });

    it("toolCall result is appended as tool message in agent state", async () => {
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool", { input: "state-test" });

        agent.onToolCall(() => ({ success: true, data: { serialized: "yes" } }));

        await agent.userMessage({ content: "hi" });
        const toolMsg = agent.state.messages.find((m) => m.role === "tool");
        expect(toolMsg).toBeDefined();
        expect(toolMsg?.content).toBe(JSON.stringify({ serialized: "yes" }));
    });

    it("default handler result (when toolCall skips) also propagates to after:toolCall", async () => {
        let afterResult: unknown;
        const { tool: t } = makeTestTool();
        const agent = fragola.agent({ name: "a", instructions: "", description: "", tools: [t] });
        injectToolCall(agent, "myTool", { input: "passthrough" });

        agent.onToolCall(() => skip());
        agent.onAfterToolCall((result) => { afterResult = result; });

        await agent.userMessage({ content: "hi" });
        expect(afterResult).toEqual({ success: true, data: "handler-result:passthrough" });
    });
});
