/**
 * Tests for the step event pair:
 *   before:step → after:step
 *
 * These tests avoid real API calls by injecting assistant replies via
 * before:modelInvocation.
 */
import { describe, it, expect, vi } from "vitest";
import { skip } from "@fragola-ai/agent/event";
import { injectReply } from "../injectReply";
import { createTestClient } from "./createTestClient";

const fragola = createTestClient();

// ─────────────────────────────────────────────────────────────────────────────
// before:step
// ─────────────────────────────────────────────────────────────────────────────

describe("before:step — option modification", () => {
    it("can override step options before execution", async () => {
        let receivedOptions: { maxStep?: number; resetStepCountAfterUserMessage?: boolean } | undefined;
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("ok"));

        agent.onBeforeStep((options) => ({
            ...options,
            maxStep: 1,
            resetStepCountAfterUserMessage: false,
        }));
        agent.onAfterStep((options) => {
            receivedOptions = options;
        });

        await agent.userMessage({ content: "hi" });
        expect(receivedOptions).toMatchObject({
            maxStep: 1,
            resetStepCountAfterUserMessage: false,
        });
    });

    it("multiple before:step handlers: last non-skip wins", async () => {
        let receivedMaxStep: number | undefined;
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("ok"));

        agent.onBeforeStep((options) => ({ ...options, maxStep: 1 }));
        agent.onBeforeStep((options) => ({ ...options, maxStep: 2 }));
        agent.onAfterStep((options) => {
            receivedMaxStep = options.maxStep;
        });

        await agent.userMessage({ content: "hi" });
        expect(receivedMaxStep).toBe(2);
    });

    it("skip in before:step keeps the current options and passes to next handler", async () => {
        const order: number[] = [];
        let receivedReset: boolean | undefined;
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("ok"));

        agent.onBeforeStep(() => { order.push(1); return skip() as any; });
        agent.onBeforeStep((options) => {
            order.push(2);
            return { ...options, resetStepCountAfterUserMessage: false };
        });
        agent.onAfterStep((options) => {
            receivedReset = options.resetStepCountAfterUserMessage;
        });

        await agent.userMessage({ content: "hi" });
        expect(order).toEqual([1, 2]);
        expect(receivedReset).toBe(false);
    });
});

describe("before:step — stop", () => {
    it("stop prevents step execution entirely", async () => {
        const afterCalled = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("never-used"));

        agent.onBeforeStep((_options, ctx) => ctx.stop() as any);
        agent.onAfterStep(() => { afterCalled(); });

        const state = await agent.userMessage({ content: "hi" });
        expect(afterCalled).not.toHaveBeenCalled();
        expect(state.stepCount).toBe(0);
        expect(state.messages.filter((message) => message.role === "assistant")).toHaveLength(0);
    });

    it("stop in the first before:step handler prevents subsequent handlers from running", async () => {
        const secondCalled = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });

        agent.onBeforeStep((_options, ctx) => ctx.stop() as any);
        agent.onBeforeStep((options) => {
            secondCalled();
            return { ...options, maxStep: 1 };
        });

        await agent.userMessage({ content: "hi" });
        expect(secondCalled).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// after:step
// ─────────────────────────────────────────────────────────────────────────────

describe("after:step — callback behavior", () => {
    it("is called once with normalized options, new messages, and stepsTaken", async () => {
        let receivedOptions: { maxStep?: number; resetStepCountAfterUserMessage?: boolean } | undefined;
        let receivedMessages: Array<{ role: string; content?: unknown }> = [];
        let receivedStepsTaken: number | undefined;
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("result"));

        agent.onAfterStep((options, newMessages, stepsTaken) => {
            receivedOptions = options;
            receivedMessages = newMessages.map((message) => ({
                role: message.role,
                content: "content" in message ? message.content : undefined,
            }));
            receivedStepsTaken = stepsTaken;
        });

        await agent.userMessage({ content: "hi" });
        expect(receivedOptions).toMatchObject({
            maxStep: 10,
            resetStepCountAfterUserMessage: true,
        });
        expect(receivedStepsTaken).toBe(1);
        expect(receivedMessages).toEqual([{ role: "assistant", content: "result" }]);
    });

    it("multiple after:step handlers are all called in order", async () => {
        const calls: number[] = [];
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("ok"));

        agent.onAfterStep(() => { calls.push(1); });
        agent.onAfterStep(() => { calls.push(2); });
        agent.onAfterStep(() => { calls.push(3); });

        await agent.userMessage({ content: "hi" });
        expect(calls).toEqual([1, 2, 3]);
    });

    it("unsubscribe removes an after:step handler", async () => {
        const called = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("ok"));

        const off = agent.onAfterStep(() => { called(); });
        off();

        await agent.userMessage({ content: "hi" });
        expect(called).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// before:step → after:step connection
// ─────────────────────────────────────────────────────────────────────────────

describe("before:step → after:step connection", () => {
    it("options returned by before:step are what after:step receives", async () => {
        let afterOptions: { maxStep?: number; resetStepCountAfterUserMessage?: boolean } | undefined;
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("ok"));

        agent.onBeforeStep((options) => ({
            ...options,
            maxStep: 3,
            resetStepCountAfterUserMessage: false,
        }));
        agent.onAfterStep((options) => {
            afterOptions = options;
        });

        await agent.userMessage({ content: "hi" });
        expect(afterOptions).toMatchObject({
            maxStep: 3,
            resetStepCountAfterUserMessage: false,
        });
    });

    it("after:step newMessages contains only messages produced during the step", async () => {
        let newMessagesRoles: string[] = [];
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("assistant-only"));

        agent.onAfterStep((_options, newMessages) => {
            newMessagesRoles = newMessages.map((message) => message.role);
        });

        const state = await agent.userMessage({ content: "hi" });
        expect(state.messages.some((message) => message.role === "user")).toBe(true);
        expect(newMessagesRoles).toEqual(["assistant"]);
    });
});