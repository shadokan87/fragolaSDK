import { Fragola, tool, type Tool } from "./src/fragola";
import { PORTKEY_GATEWAY_URL, createHeaders } from "portkey-ai";
import { createStore, type AgentAny, type UserMessageQuery } from "./src/agent";
import z from "zod";

export const weatherStore = createStore<{ lastWeather: Record<string, string> | undefined }>({
    lastWeather: undefined
});

async function main() {
    const fragola = new Fragola({
        apiKey: 'xxx',
        baseURL: PORTKEY_GATEWAY_URL,
        defaultHeaders: createHeaders({
            virtualKey: process.env["BEDROCK_DEV"],
            apiKey: process.env["PORTKEY_API_KEY"]
        })
    });

    let tools: Tool[] = [];

    for (let i = 0; i < 3; i++) {
        tools.push(
            tool({
                name: `test_tool_${i}`,
                description: "a test tool",
                schema: z.object({
                    id: z.string()
                }),
                handler: (parameters) => {
                    return "test successful, you can stop generating";
                }
            })
        )
    }

    const weatherAgent = fragola.agent({
        name: "test", instructions: "you are a helpful assistant", tools,
        store: weatherStore,
        modelSettings: {
            model: 'us.anthropic.claude-3-5-haiku-20241022-v1:0' as any,
            temperature: 1,
            stream: true,
            tool_choice: "auto",
        }
    });

    weatherAgent.onUserMessage((message) => {
        // return skip();
        return { ...message, content: message.content + "all in the same" };
    });

    weatherAgent.onUserMessage((message) => {
        // return skip();
        return { ...message, content: message.content + " response" };
    });

    // weatherAgent.onAiMessage((aiMessage, isPartial, context) => {
    //     if (!isPartial) {
    //         console.log("!context", context.state.status);
    //         aiMessage.content = aiMessage.content + "(modified again)";
    //     }
    //     return aiMessage;
    // });

    weatherAgent.onAfterStateUpdate(({ state }) => {
        // const last = state.conversation.at(-1);
        // if (last && last.role == "assistant")
        //     console.log(last.content);
        console.log(state.status, JSON.stringify(state.conversation, null, 2));
    });

    const { conversation } = await weatherAgent.userMessage({ content: "generate a random poem and call tool 1." });
}

(async () => await main())();