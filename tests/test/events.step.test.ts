import { injectReply } from "../injectReply";
/**
 * Tests for the step event trio: before:step → step → after:step
 *
 * Signatures:
 *   before:step  (options, context) => void              — can stop execution only
 *   step         (options, lastMessageRole, lastMessageIndex, context) => options|skip|stop
 *   after:step   (options, newMessages, stepsTaken, context) => void
 *
 * Each test injects an assistant message via `before:modelInvocation` so no real
 * API call is required.
 */
import { describe, it, expect, vi } from "vitest";
import { skip, stop } from "@fragola-ai/agentic-sdk-core/event";
import type { AgentAny, StepOptions } from "@fragola-ai/agentic-sdk-core/agent";
import { createTestClient } from "./createTestClient";

const fragola = createTestClient();

/** Inject a canned assistant reply so no real model call is made. */
// function injectReply(agent: AgentAny, content = "ok") {
//     return agent.onBeforeModelInvocation(() => ({ injectMessage: { content } }));
// }

describe("step event trio — invocation order", () => {
    it("fires before:step → step → after:step in that order", async () => {
        const order: string[] = [];
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply());

        agent.onBeforeStep(() => { order.push("before"); });
        agent.onStep((opts) => { order.push("step"); return opts; });
        agent.onAfterStep(() => { order.push("after"); });

        await agent.userMessage({ content: "hi" });
        expect(order).toEqual(["before", "step", "after"]);
    });

    it("all three callbacks receive options", async () => {
        const received: string[] = [];
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply());

        agent.onBeforeStep((opts) => { if (opts.maxStep !== undefined) received.push("before"); });
        agent.onStep((opts) => { if (opts.maxStep !== undefined) received.push("step"); return opts; });
        agent.onAfterStep((opts) => { if (opts.maxStep !== undefined) received.push("after"); });

        await agent.userMessage({ content: "hi" });
        expect(received).toEqual(["before", "step", "after"]);
    });

    it("step receives lastMessageRole and lastMessageIndex", async () => {
        let lastMessageRole: string | undefined;
        let lastMessageIndex: number | undefined;
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply());

        agent.onStep((opts, role, index) => {
            lastMessageRole = role;
            lastMessageIndex = index;
            return opts;
        });

        await agent.userMessage({ content: "hi" });
        expect(lastMessageRole).toBe("user");
        expect(lastMessageIndex).toBe(0);
    });
});

describe("step event trio — skip", () => {
    it("skip in step keeps the original options and still calls after:step", async () => {
        const afterCalled = vi.fn();
        const agent = fragola.agent({
            name: "a",
            instructions: "",
            description: "",
            stepOptions: { maxStep: 5 },
        });
        agent.use(injectReply());

        agent.onStep(() => skip());
        agent.onAfterStep((opts) => {
            console.log("_OPTS_CALLBACK_", JSON.stringify(opts, null, 2));
            console.log("_OPTS_GETTER_", JSON.stringify(agent.options, null, 2))
            afterCalled(opts.maxStep);
        });

        await agent.userMessage({ content: "hi" });
        // after:step is still called; options are the originals (maxStep = 5)
        expect(afterCalled).toHaveBeenCalledOnce();
        expect(afterCalled).toHaveBeenCalledWith(5);
    });

    it("multiple step handlers: skip passes through to next handler", async () => {
        const called: number[] = [];
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply());

        agent.onStep(() => { called.push(1); return skip(); });
        agent.onStep((opts) => { called.push(2); return opts; });

        await agent.userMessage({ content: "hi" });
        expect(called).toEqual([1, 2]);
    });
});

describe("step event trio — stop", () => {
    it("stop in before:step prevents model invocation", async () => {
        const modelCalled = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });

        agent.onBeforeModelInvocation(() => { modelCalled(); return { injectMessage: { content: "hi" } }; });
        agent.onBeforeStep(() => stop() as any);

        const state = await agent.userMessage({ content: "hi" });
        expect(modelCalled).not.toHaveBeenCalled();
        expect(state.messages.filter((m) => m.role === "assistant")).toHaveLength(0);
    });

    it("stop in before:step prevents step and after:step from running", async () => {
        const stepCalled = vi.fn();
        const afterCalled = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply());

        agent.onBeforeStep(() => stop() as any);
        agent.onStep((opts) => { stepCalled(); return opts; });
        agent.onAfterStep(() => { afterCalled(); });

        await agent.userMessage({ content: "hi" });
        expect(stepCalled).not.toHaveBeenCalled();
        expect(afterCalled).not.toHaveBeenCalled();
    });

    it("stop in step prevents model invocation and after:step", async () => {
        const modelCalled = vi.fn();
        const afterCalled = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });

        agent.onBeforeModelInvocation(() => { modelCalled(); return { injectMessage: { content: "hi" } }; });
        agent.onStep(() => stop());
        agent.onAfterStep(() => { afterCalled(); });

        const state = await agent.userMessage({ content: "hi" });
        expect(modelCalled).not.toHaveBeenCalled();
        expect(afterCalled).not.toHaveBeenCalled();
        expect(state.messages.filter((m) => m.role === "assistant")).toHaveLength(0);
    });
});

describe("step event trio — connection: options flow from step → after:step", () => {
    it("options modified in step are received in after:step", async () => {
        let afterMaxStep: number | undefined;
        let afterNewMessagesLength: number | undefined;
        let afterStepsTaken: number | undefined;
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply());

        agent.onStep((opts) => ({ ...opts, maxStep: 42 }));
        agent.onAfterStep((opts, newMessages, stepsTaken) => {
            afterMaxStep = opts.maxStep;
            afterNewMessagesLength = newMessages.length;
            afterStepsTaken = stepsTaken;
        });

        await agent.userMessage({ content: "hi" });
        expect(afterMaxStep).toBe(42);
        expect(afterNewMessagesLength).toBe(1);
        expect(afterStepsTaken).toBe(1);
    });

    it("after:step receives only the messages produced during that step", async () => {
        let newMessagesRoles: string[] = [];
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply());

        await agent.userMessage({ content: "first" });
        agent.onAfterStep((_, newMessages) => {
            newMessagesRoles = newMessages.map((message) => message.role);
        });

        await agent.userMessage({ content: "second" });
        expect(newMessagesRoles).toEqual(["assistant"]);
    });

    it("last step handler wins when multiple handlers modify options", async () => {
        let afterMaxStep: number | undefined;
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply());

        agent.onStep((opts) => ({ ...opts, maxStep: 10 }));
        agent.onStep((opts) => ({ ...opts, maxStep: 99 }));
        agent.onAfterStep((opts) => { afterMaxStep = opts.maxStep; });

        await agent.userMessage({ content: "hi" });
        expect(afterMaxStep).toBe(99);
    });

    it("before:step sees the original options before step can modify them", async () => {
        let beforeMaxStep: number | undefined;
        let stepMaxStep: number | undefined;
        const agent = fragola.agent({
            name: "a",
            instructions: "",
            description: "",
            stepOptions: { maxStep: 3 },
        });
        agent.use(injectReply());

        // before:step sees original value (3)
        agent.onBeforeStep((opts) => { beforeMaxStep = opts.maxStep; });
        // step changes it
        agent.onStep((opts) => { stepMaxStep = opts.maxStep; return { ...opts, maxStep: 77 }; });

        await agent.userMessage({ content: "hi" });
        expect(beforeMaxStep).toBe(3);
        expect(stepMaxStep).toBe(3); // step also receives the original value
    });

    it("unsubscribe removes a step handler", async () => {
        const called = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply());

        const off = agent.onStep((opts) => { called(); return opts; });
        off();

        await agent.userMessage({ content: "hi" });
        expect(called).not.toHaveBeenCalled();
    });
});
