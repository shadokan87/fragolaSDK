import { describe, it, expect } from "vitest";
import { tool } from "@fragola-ai/agentic-sdk-core";
import type { ChatCompletionMessageParam } from "@fragola-ai/agentic-sdk-core";
import { createTestClient } from "./createTestClient";
import { z } from "zod";

const fragola = createTestClient();
const agentBase = fragola.agent({
    name: "assistant",
    instructions: "",
    description: ""
});

agentBase.onModelInvocation(async () => ({role: "assistant", content: "(completion not needed for these tests)"}));

describe("Tool schema parsing in step()", () => {
    const makeAssistantToolCall = (name: string, args: any): ChatCompletionMessageParam => ({
        role: "assistant",
        content: null as any,
        tool_calls: [
            {
                id: "call_1",
                type: "function",
                function: {
                    name,
                    arguments: JSON.stringify(args)
                }
            }
        ]
    } as any);

    it("Zod schema: invalid args should fail parsing on step(by:1)", async () => {
        const weatherTool = tool({
            name: "get_weather",
            description: "Returns weather for a location",
            schema: z.object({ location: z.string() }),
            handler: (params: { location: string }) => `Weather in ${params.location}`
        });

        const fragola = createTestClient({ model: "gpt-3" });
        const agent = fragola.agent({
            name: "t",
            description: "d",
            instructions: "i",
            tools: [weatherTool],
            initialConversation: [
                { role: "user", content: "What is the weather?" } as ChatCompletionMessageParam,
                makeAssistantToolCall("get_weather", { location: 123 })
            ]
        });
        agent.onModelInvocation(async () => ({role: "assistant", content: ""}))

        await expect(agent.step({ by: 1 })).rejects.toThrow();
    });

    it("Zod schema: valid args should succeed and append tool message", async () => {
        const weatherTool = tool({
            name: "get_weather",
            description: "Returns weather for a location",
            schema: z.object({ location: z.string() }),
            handler: (params: { location: string }) => `OK:${params.location}`
        });

        const agent = fragola.agent({
            name: "t",
            description: "d",
            instructions: "i",
            tools: [weatherTool],
            initialConversation: [
                { role: "user", content: "Weather?" } as ChatCompletionMessageParam,
                makeAssistantToolCall("get_weather", { location: "Paris" })
            ]
        })
        agent.onModelInvocation(async () => ({role: "assistant", content: ""}));

        const state = await agent.step({ by: 1 });
        const last = state.conversation.at(-1)!;
        expect(last.role).toBe("tool");
        expect(typeof (last as any).tool_call_id).toBe("string");
        expect((last as any).content).toContain("OK:Paris");
    });

    it("String schema: invalid args should NOT trigger validation and still succeed", async () => {
        const jsonSchema = JSON.stringify({
            type: "object",
            properties: { location: { type: "string" } },
            required: ["location"]
        });

        const weatherTool = tool({
            name: "get_weather",
            description: "Returns weather for a location",
            schema: jsonSchema as any,
            handler: (params: any) => `RAW:${String(params?.location)}`
        });

        const fragola = createTestClient({ model: "gpt-3" });
        const agent = fragola.agent({
            name: "t",
            description: "d",
            instructions: "i",
            tools: [weatherTool],
            initialConversation: [
                { role: "user", content: "Weather?" } as ChatCompletionMessageParam,
                makeAssistantToolCall("get_weather", { location: 42 })
            ]
        });
        agent.onModelInvocation(async () => ({role: "assistant", content: ""}));
        const state = await agent.step({ by: 1 });
        const last = state.conversation.at(-1)!;
        expect(last.role).toBe("tool");
        expect((last as any).content).toContain("RAW:42");
    });
});
