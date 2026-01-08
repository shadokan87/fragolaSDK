//@ts-nocheck
import { describe, it, expect } from "vitest";
import { tool } from "@fragola-ai/agentic-sdk-core";
import { createTestClient } from "./createTestClient";
import { z } from "zod";
import Ajv from "ajv";
import type OpenAI from "openai";
import type { FragolaHook } from "@fragola-ai/agentic-sdk-core/hook";
import {fileSystemSave} from "@fragola-ai/agentic-sdk-core/hook/presets"

const fragola = createTestClient();
// Used to avoid token cost for tests where model response is not relevant
const noCompletion: FragolaHook = (agent) => {
    agent.onModelInvocation(async () => ({role: "assistant", content: ""}))
}

describe("Tool schema parsing in step()", () => {
    const makeAssistantToolCall = (name: string, args: any): OpenAI.ChatCompletionMessageParam => ({
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
    });

    it("Zod schema: invalid args should fail parsing on step(by:1)", async () => {
        const weatherTool = tool({
            name: "get_weather",
            description: "Returns weather for a location",
            schema: z.object({ location: z.string() }),
            handler: (params: { location: string }) => `Weather in ${params.location}`
        });

        const agent = fragola.agent({
            name: "t",
            description: "d",
            instructions: "i",
            tools: [weatherTool],
            initialConversation: [
                { role: "user", content: "What is the weather?" },
                makeAssistantToolCall("get_weather", { location: 123 })
            ]
        }).use(noCompletion);

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
                { role: "user", content: "Weather?" },
                makeAssistantToolCall("get_weather", { location: "Paris" })
            ]
        }).use(noCompletion).use(fileSystemSave("./inspect/conv"))

        const state = await agent.step({ by: 1 });
        const last = state.conversation.at(-2)!;
        expect(last.role).toBe("tool");
        expect(typeof (last as any).tool_call_id).toBe("string");
        expect((last as any).content).toContain("OK:Paris");
    });

    it("String schema: Ajv 1 valid, 1 invalid.", async () => {
        const jsonSchemaObj = {
            type: "object",
            properties: { location: { type: "string" } },
            required: ["location"]
        };
        const ajv = new Ajv();
        const validate = ajv.compile(jsonSchemaObj);

        const weatherTool = tool({
            name: "get_weather",
            description: "Returns weather for a location",
            schema: JSON.stringify(jsonSchemaObj),
            handler: (params: any) => {
                // Validate with AJV inside the handler
                if (!validate(params)) {
                    return `INVALID:${JSON.stringify(validate.errors)}`;
                }
                return `RAW:${String(params?.location)}`;
            }
        });


        // Test with invalid args
        const agentInvalid = fragola.agent({
            name: "t",
            description: "d",
            instructions: "i",
            tools: [weatherTool],
            initialConversation: [
                { role: "user", content: "Weather?" },
                makeAssistantToolCall("get_weather", { location: 42 })
            ]
        }).use(noCompletion);
        const stateInvalid = await agentInvalid.step({ by: 1 });
        const lastInvalid = stateInvalid.conversation.at(-2)!;
        expect(lastInvalid.role).toBe("tool");
        expect((lastInvalid as any).content).toContain("INVALID");

        // Test with valid args
        const agentValid = fragola.agent({
            name: "t",
            description: "d",
            instructions: "i",
            tools: [weatherTool],
            initialConversation: [
                { role: "user", content: "Weather?" },
                makeAssistantToolCall("get_weather", { location: "Paris" })
            ]
        }).use(noCompletion);
        const stateValid = await agentValid.step({ by: 1 });
        const lastValid = stateValid.conversation.at(-2)!;
        expect(lastValid.role).toBe("tool");
        expect((lastValid as any).content).toContain("RAW:Paris");
    });
});
