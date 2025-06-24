import { Fragola } from "./fragola/fragola";
import { PORTKEY_GATEWAY_URL, createHeaders } from "portkey-ai";

async function main() {
    const fragola = new Fragola({
        apiKey: 'xxx',
        baseURL: PORTKEY_GATEWAY_URL,
        defaultHeaders: createHeaders({
            virtualKey: process.env["BEDROCK_DEV"],
            apiKey: process.env["PORTKEY_API_KEY"]
        })
    });

    const test = fragola.Agent({
        name: "test", instructions: "you are a helpful assistant", llmParams: {
            model: 'us.anthropic.claude-3-5-haiku-20241022-v1:0' as any,
            temperature: 1,
            stream: true,
            tool_choice: "auto"
        }
    });

    const { conversation } = await test.userMessage({ content: "give me a random poem" });
    console.log(JSON.stringify(conversation));
}

(async () => await main())();