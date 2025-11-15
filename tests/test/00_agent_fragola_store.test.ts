import { describe, it, expect } from "vitest";
import { createStore } from "@fragola-ai/agentic-sdk-core/store";
import { createTestClient } from "./createTestClient";
const getTestStore = (namespace = "test") => createStore({ value: 42 }, namespace);

describe("Agent store methods", () => {
    it("addStore should add a store to namespaceStore", () => {
            const fragola = createTestClient();
        const agent = fragola.agent({
            name: "testAgent",
            instructions: "",
            description: "",
            store: getTestStore("main")
        });
        const store = getTestStore("foo");
        agent.context.addStore(store);
        expect(agent.context.getStore("foo")).toBe(store);
    });

    it("addStore should throw if namespace is missing", () => {
            const fragola = createTestClient();
        const agent = fragola.agent({
            name: "testAgent",
            instructions: "",
            description: "",
            store: getTestStore("main")
        });
        const store = createStore({ value: 1 });
        expect(() => agent.context.addStore(store)).toThrow();
    });

    it("addStore should throw if namespace already exists", () => {
            const fragola = createTestClient();
        const agent = fragola.agent({
            name: "testAgent",
            instructions: "",
            description: "",
            store: getTestStore("main")
        });
        const store = getTestStore("foo");
        agent.context.addStore(store);
        expect(() => agent.context.addStore(store)).toThrow();
    });

    it("removeStore should remove a store from namespaceStore", () => {
            const fragola = createTestClient();
        const agent = fragola.agent({
            name: "testAgent",
            instructions: "",
            description: "",
            store: getTestStore("main")
        });
        const store = getTestStore("foo");
        agent.context.addStore(store);
        agent.context.removeStore("foo");
        expect(agent.context.getStore("foo")).toBeUndefined();
    });

    it("removeStore should not throw if namespace does not exist", () => {
            const fragola = createTestClient();
        const agent = fragola.agent({
            name: "testAgent",
            instructions: "",
            description: "",
            store: getTestStore("main")
        });
        expect(() => agent.context.removeStore("doesnotexist")).not.toThrow();
    });
});

describe("Fragola store methods", () => {
    it("should expose all public methods", () => {
           const fragola = createTestClient();
        expect(typeof fragola.agent).toBe("function");
        expect(typeof fragola.getStore).toBe("function");
        expect(typeof fragola.addStore).toBe("function");
        expect(typeof fragola.removeStore).toBe("function");
        expect(typeof fragola.json).toBe("function");
        expect(typeof fragola.boolean).toBe("function");
        expect(fragola.options).toBeDefined();
        expect("store" in fragola).toBe(true);
    });
    it("addStore should add a store to namespaceStore", () => {
           const fragola = createTestClient();
        const store = getTestStore("foo");
        fragola.addStore(store);
        expect(fragola.getStore("foo")).toBe(store);
    });

    it("addStore should throw if namespace is missing", () => {
           const fragola = createTestClient();
        const store = createStore({ value: 1 });
        expect(() => fragola.addStore(store)).toThrow();
    });

    it("addStore should throw if namespace already exists", () => {
           const fragola = createTestClient();
        const store = getTestStore("foo");
        fragola.addStore(store);
        expect(() => fragola.addStore(store)).toThrow();
    });

    it("removeStore should remove a store from namespaceStore", () => {
           const fragola = createTestClient();
        const store = getTestStore("foo");
        fragola.addStore(store);
        fragola.removeStore("foo");
        expect(fragola.getStore("foo")).toBeUndefined();
    });

    it("removeStore should not throw if namespace does not exist", () => {
           const fragola = createTestClient();
        expect(() => fragola.removeStore("doesnotexist")).not.toThrow();
    });
});
