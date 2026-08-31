import { Fragola } from "../src/fragola";
import { provider } from "./src";

const fragola = new Fragola({
    apiKey: process.env["GOOGLE_API_KEY"],
    model: process.env["TEST_MODEL_MEDIUM"]!
});

const agent = fragola.agent({
  name: "assistant",
  description: "Minimal assistant",
  instructions: "You are a helpful assistant."
}).use(provider("google", {}))

try {
    const {messages} = await agent.userMessage({content: "testing api, Say hi"});
    console.log(JSON.stringify(messages, null, 2));
} catch(e) {
    console.error(e);
}