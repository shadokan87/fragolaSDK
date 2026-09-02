import { Fragola } from "../src/fragola";
import { createLocalGatewayFetch, provider } from "./src";

const fragola = new Fragola({
    model: "@google/gemini-3.7-flash",
    apiKey: process.env["GOOGLE_API_KEY"],
    baseURL: "http://127.0.0.1/v1",
    fetch: createLocalGatewayFetch()
});
console.log("__KEY__",process.env["GOOGLE_API_KEY"])
const agent = fragola.agent({
    name: "assistant",
    description: "",
    instructions: "you are a helpful assistant"
})
.use(provider("google", {}));
await agent.init();
const {messages} = await agent.userMessage({content: "this is a test, say hi"});
console.log(JSON.stringify(messages, null, 2));