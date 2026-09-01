import { Fragola } from "../src/fragola";
import { provider } from "./src";

const fragola = new Fragola({
    model: process.env["TEST_MODEL_MEDIUM"]!,
    apiKey: process.env["GOOGLE_API_KEY"]
});

const agent = fragola.agent({
    name: "assistant",
    description: "",
    instructions: ""
}).use(provider("google", {}));

const {messages} = await agent.userMessage({content: "this is a test, say hi"});
console.log(JSON.stringify(messages, null, 2));