import { fileSystemSave, orchestration } from "hook.presets.index";
import { Fragola } from "./src/fragola";

const fragola = new Fragola({
  baseURL: process.env.TEST_BASEURL,
  apiKey: process.env.TEST_API_KEY,
  model: "gpt-4.1-mini",
});

const greetingAgent = fragola.agent({
    name: "greetings agent",
    instructions: "you are a helpful assistant",
    description: "says warm greetings to new clients"
});

const agentA = fragola.agent({
    name: "assistant",
    instructions: "you are a helful assistant",
    description: "assistant agent"
});

agentA.use(orchestration(lead => {
    return {
        participants: [lead, greetingAgent],
        flow: [
            [lead, {to: greetingAgent}],
        ],
        onMessage: (src, dst, message, reject) => {
            return reject("You don't have the permissions to message this agent");
            return message;
        }
    }
})).use(fileSystemSave("./testOrchestration"));

await agentA.userMessage({content: "ask greetingAgent to say hello"});