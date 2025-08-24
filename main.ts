import { Fragola } from "./src/fragola";
import { PORTKEY_GATEWAY_URL, createHeaders } from "portkey-ai";
import getWeatherForCity from "./src/tools/getWeatherForCity";
import { createStore } from "./src/agent";

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

    const weatherAgent = fragola.agent({
        name: "test", instructions: "you are a helpful assistant", tools: [getWeatherForCity],
        store: weatherStore,
        modelSettings: {
            model: 'us.anthropic.claude-3-5-haiku-20241022-v1:0' as any,
            temperature: 1,
            stream: true,
            tool_choice: "required"
        }
    });

    return ;
    const { conversation } = await weatherAgent.userMessage({ content: "what is the weather in Paris ?" });
    console.log(JSON.stringify(conversation, null, 2));
}

(async () => await main())();