/**
 * Tests for the after:stateUpdate event.
 *
 * These tests avoid real API calls by injecting assistant replies via
 * before:modelInvocation.
 */
import { describe, it, expect, vi } from "vitest";
import { injectReply } from "../injectReply";
import { createTestClient } from "./createTestClient";

const fragola = createTestClient();

// ─────────────────────────────────────────────────────────────────────────────
// after:stateUpdate — callback behavior
// ─────────────────────────────────────────────────────────────────────────────

describe("after:stateUpdate — callback behavior", () => {
    it("observes state transitions during a non-streaming userMessage turn", async () => {
        const snapshots: Array<{ status: string; stepCount: number; roles: string[] }> = [];
        const agent = fragola.agent({
            name: "a",
            instructions: "",
            description: "",
            stepOptions: { resetStepCountAfterUserMessage: false },
        });
        agent.use(injectReply("ok"));

        agent.onAfterStateUpdate((context) => {
            snapshots.push({
                status: context.state.status,
                stepCount: context.state.stepCount,
                roles: context.state.messages.map((message) => message.role),
            });
        });

        await agent.userMessage({ content: "hi" });
        expect(snapshots.length).toBeGreaterThanOrEqual(5);
        expect(snapshots[0]).toEqual({
            status: "idle",
            stepCount: 0,
            roles: ["user"],
        });
        expect(snapshots.some((snapshot) => snapshot.status === "generating")).toBe(true);
        expect(snapshots.at(-1)).toEqual({
            status: "idle",
            stepCount: 1,
            roles: ["user", "assistant"],
        });
    });

    it("multiple after:stateUpdate handlers are all called for the same update in registration order", async () => {
        const calls: number[] = [];
        let matchedFirstUpdate = false;
        const agent = fragola.agent({
            name: "a",
            instructions: "",
            description: "",
            stepOptions: { resetStepCountAfterUserMessage: false },
        });
        agent.use(injectReply("ok"));

        agent.onAfterStateUpdate((context) => {
            if (!matchedFirstUpdate && context.state.status === "idle" && context.state.messages.length === 1) {
                calls.push(1);
            }
        });
        agent.onAfterStateUpdate((context) => {
            if (!matchedFirstUpdate && context.state.status === "idle" && context.state.messages.length === 1) {
                calls.push(2);
                matchedFirstUpdate = true;
            }
        });

        await agent.userMessage({ content: "hi" });
        expect(calls).toEqual([1, 2]);
    });

    it("unsubscribe removes an after:stateUpdate handler", async () => {
        const called = vi.fn();
        const agent = fragola.agent({ name: "a", instructions: "", description: "" });
        agent.use(injectReply("ok"));

        const off = agent.onAfterStateUpdate(() => { called(); });
        off();

        await agent.userMessage({ content: "hi" });
        expect(called).not.toHaveBeenCalled();
    });
});