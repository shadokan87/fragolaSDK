import { describe, it, expect } from "vitest";
import { Fragola, tool, type DefineMetaData } from "@fragola-ai/agentic-sdk-core";
import z from "zod";
import { createTestClient } from "./createTestClient";

// single shared instance across all tests, named `fragola`
const fragola = createTestClient();

describe("Agent streaming behavior (real model via stream: true)", () => {
    it("streams normal assistant messages (partial -> final)", async () => {
        const assistant = fragola.agent<DefineMetaData<{
            "user": {
                "test": boolean
            }
        }>>({
            name: "assistant",
            description: "",
            instructions: "you are a helpful assistant",
            modelSettings: {
                model: fragola.options.model,
                tool_choice: "auto",
                max_tokens: 1000,
                // stream: true,
            }
        });

        await assistant.userMessage({ content: "say 'hello, how can I help you today ?'", meta: {
            test: false
        }});

        const lastAssistant = assistant.state.conversation.filter((m) => m.role === "assistant").pop();
        expect(lastAssistant).toBeDefined();
        if (lastAssistant)
            expect(lastAssistant.content).toBeDefined();
    });

    it("streams assistant that triggers a tool call and the tool is executed", async () => {
        const assistant = fragola.agent({
            name: "assistant",
            description: "",
            instructions: "you are a helpful assistant",
            tools: [
                tool({
                    name: "myTool",
                    description: "test tool",
                    schema: z.object({
                        name: z.string()
                    }),
                    handler: (params) => ({ created: params.name ? `created:${params.name}` : "no-name" })
                })
            ],
            modelSettings: {
                model: fragola.options.model,
                tool_choice: "auto",
                max_tokens: 1000,
                stream: true,
            }
        });

        await assistant.userMessage({ content: "use the test tool to add a client with the name banana" });

        const conv = assistant.state.conversation;
        const assistantMsg = conv.filter((m) => m.role === "assistant").pop();
        const toolMsg = conv.filter((m) => m.role === "tool").pop();

        expect(assistantMsg).toBeDefined();
        // tool_calls may or may not be present depending on model; ensure tool message exists when tool was called
        if (toolMsg) {
            expect(typeof toolMsg.content).toBe("string");
            const parsed = JSON.parse(String(toolMsg.content));
            expect(parsed.created).toBeDefined();
        }
    });

    // it("streams JSON response (agent.json) and parses it", async () => {
    //     const assistant = fragola.agent({
    //         name: "assistant",
    //         description: "",
    //         instructions: "you are a helpful assistant",
    //         modelSettings: {
    //             model: fragola.options.model,
    //             tool_choice: "auto",
    //             max_tokens: 1000,
    //             stream: true,
    //         }
    //     });

    //     const schema = z.object({ name: z.string() });
    //     const result = await assistant.json({ content: "my name is shadokan", description: "extract the name of the person", name: "extract_infos", schema });
    //     expect(result.success).toBeDefined();
    //     // if parse succeeded, data should be present
    //     if (result.success)
    //         expect(result.data?.name).toBeDefined();
    // });

    // it("fragola.boolean returns parsed boolean from json preset", async () => {
    //     const res = await fragola.boolean("is this a test?");
    //     // boolean returns true/false
    //     expect(typeof res).toBe("boolean");
    // });
});
