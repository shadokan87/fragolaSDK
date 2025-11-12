import { Fragola } from "@src/fragola";
import { mcpClient } from "@src/hook/presets/mcpClient";

const fragola = new Fragola({
  baseURL: process.env.TEST_BASEURL,
  apiKey: process.env.TEST_API_KEY,
  model: "gpt-4.1-mini",
});

const assistant = fragola.agent({
    name: "assistant",
    description: "",
    instructions: "you are a helpful assistant"
}).use(mcpClient({
    name: "client",
    url: "http://localhost:3000/mcp"
}));

console.log("tools", JSON.stringify(assistant.context.options.tools, null, 2));