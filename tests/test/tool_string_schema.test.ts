import { describe, it, expect } from "vitest";
import { tool } from "@fragola-ai/agent";
import { createTestClient } from "./createTestClient";
import { z } from "zod";
import Ajv from "ajv";
import type OpenAI from "openai";
import type { FragolaHook } from "@fragola-ai/agent/hook";

const fragola = createTestClient();
// Used to avoid token cost for tests where model response is not relevant
const noCompletion: FragolaHook = (agent) => {
    agent.onBeforeModelInvocation(async () => {
        return {
            injectMessage: {
                    content: ""
            }
        }
    });
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

    it("Zod schema: invalid args should append a failure payload on step(by:1)", async () => {
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
            messages: [
                { role: "user", content: "What is the weather?" },
                makeAssistantToolCall("get_weather", { location: 123 })
            ]
        }).use(noCompletion);

        const state = await agent.step({ by: 1 });
        const last = state.messages.at(-2)!;
        expect(last.role).toBe("tool");
        const payload = JSON.parse(String((last as any).content));
        expect(payload).toBe("Tool parameters invalid");
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
            messages: [
                { role: "user", content: "Weather?" },
                makeAssistantToolCall("get_weather", { location: "Paris" })
            ]
        }).use(noCompletion)

        const state = await agent.step({ by: 1 });
        const last = state.messages.at(-2)!;
        expect(last.role).toBe("tool");
        expect(typeof (last as any).tool_call_id).toBe("string");
        const payload = JSON.parse(String((last as any).content));
        expect(payload).toBe("OK:Paris");
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
            messages: [
                { role: "user", content: "Weather?" },
                makeAssistantToolCall("get_weather", { location: 42 })
            ]
        }).use(noCompletion);
        const stateInvalid = await agentInvalid.step({ by: 1 });
        const lastInvalid = stateInvalid.messages.at(-2)!;
        expect(lastInvalid.role).toBe("tool");
        const payloadInvalid = JSON.parse(String((lastInvalid as any).content));
        expect(payloadInvalid).toEqual(expect.stringContaining("INVALID"));

        // Test with valid args
        const agentValid = fragola.agent({
            name: "t",
            description: "d",
            instructions: "i",
            tools: [weatherTool],
            messages: [
                { role: "user", content: "Weather?" },
                makeAssistantToolCall("get_weather", { location: "Paris" })
            ]
        }).use(noCompletion);
        const stateValid = await agentValid.step({ by: 1 });
        const lastValid = stateValid.messages.at(-2)!;
        expect(lastValid.role).toBe("tool");
        const payloadValid = JSON.parse(String((lastValid as any).content));
        expect(payloadValid).toBe("RAW:Paris");
    });
});
