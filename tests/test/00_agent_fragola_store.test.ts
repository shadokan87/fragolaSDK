import { describe, it, expect } from "vitest";
import { createStore } from "@fragola-ai/agentic-sdk-core/context";
import { createTestClient } from "./createTestClient";
const getTestContext = (namespace = "test") => createStore({ value: 42 }, namespace);

describe("Agent context methods", () => {
    it("addContext should add a context to namespaceContext", () => {
            const fragola = createTestClient();
        const agent = fragola.agent({
            name: "testAgent",
            instructions: "",
            description: "",
            context: getTestContext("main")
        });
        const context = getTestContext("foo");
        agent.context.addContext(context);
        expect(agent.context.getContext("foo")).toBe(context);
    });

    it("addContext should throw if namespace is missing", () => {
            const fragola = createTestClient();
        const agent = fragola.agent({
            name: "testAgent",
            instructions: "",
            description: "",
            context: getTestContext("main")
        });
        const context = createStore({ value: 1 });
        expect(() => agent.context.addContext(context)).toThrow();
    });

    it("addContext should throw if namespace already exists", () => {
            const fragola = createTestClient();
        const agent = fragola.agent({
            name: "testAgent",
            instructions: "",
            description: "",
            context: getTestContext("main")
        });
        const context = getTestContext("foo");
        agent.context.addContext(context);
        expect(() => agent.context.addContext(context)).toThrow();
    });

    it("removeContext should remove a context from namespaceContext", () => {
            const fragola = createTestClient();
        const agent = fragola.agent({
            name: "testAgent",
            instructions: "",
            description: "",
            context: getTestContext("main")
        });
        const context = getTestContext("foo");
        agent.context.addContext(context);
        agent.context.removeContext("foo");
        expect(agent.context.getContext("foo")).toBeUndefined();
    });

    it("removeContext should not throw if namespace does not exist", () => {
            const fragola = createTestClient();
        const agent = fragola.agent({
            name: "testAgent",
            instructions: "",
            description: "",
            context: getTestContext("main")
        });
        expect(() => agent.context.removeContext("doesnotexist")).not.toThrow();
    });
});

describe("Fragola context methods", () => {
    it("should expose all public methods", () => {
           const fragola = createTestClient();
        expect(typeof fragola.agent).toBe("function");
        expect(typeof fragola.getContext).toBe("function");
        expect(typeof fragola.addContext).toBe("function");
        expect(typeof fragola.removeContext).toBe("function");
        expect(typeof fragola.json).toBe("function");
        expect(fragola.options).toBeDefined();
        expect("context" in fragola).toBe(true);
    });
    it("addContext should add a context to namespaceContext", () => {
           const fragola = createTestClient();
        const context = getTestContext("foo");
        fragola.addContext(context);
        expect(fragola.getContext("foo")).toBe(context);
    });

    it("addContext should throw if namespace is missing", () => {
           const fragola = createTestClient();
        const context = createStore({ value: 1 });
        expect(() => fragola.addContext(context)).toThrow();
    });

    it("addContext should throw if namespace already exists", () => {
           const fragola = createTestClient();
        const context = getTestContext("foo");
        fragola.addContext(context);
        expect(() => fragola.addContext(context)).toThrow();
    });

    it("removeContext should remove a context from namespaceContext", () => {
           const fragola = createTestClient();
        const context = getTestContext("foo");
        fragola.addContext(context);
        fragola.removeContext("foo");
        expect(fragola.getContext("foo")).toBeUndefined();
    });

    it("removeContext should not throw if namespace does not exist", () => {
           const fragola = createTestClient();
        expect(() => fragola.removeContext("doesnotexist")).not.toThrow();
    });
});
