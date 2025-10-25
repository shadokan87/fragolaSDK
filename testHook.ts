import { fileSystemSave } from "@src/hookPreset";
import { Fragola } from "./src/fragola";

const fragola = new Fragola({
    baseURL: "https://eclip-mgb72e5e-northcentralus.cognitiveservices.azure.com/openai/v1/",
    apiKey: process.env.TEST_API_KEY
});

const agent = fragola.agent({
    name: "assistant",
    instructions: "you are a helpful assistant",
    modelSettings: {
        model: "gpt-oss-120b"
    }
}).use(fileSystemSave("./testHook"));

await agent.userMessage({content: "say hello"});
const state = await agent.userMessage({content: "say hello again"});
console.log(JSON.stringify(state, null, 2));