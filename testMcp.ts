import { Fragola, tool, type ClientOptions } from "@src/fragola";
import { mcpClient } from "@src/hook/presets/mcpClient";
import { createHeaders, PORTKEY_GATEWAY_URL } from 'portkey-ai';
import { fileSystemSave } from "./src/hook/presets"
import { noCompletion } from "@src/utils";

const createTestClient = (opts?: ClientOptions) => {
  const defaultOpts: ClientOptions = {
    baseURL: PORTKEY_GATEWAY_URL,
    apiKey: "xxx",
    defaultHeaders: createHeaders({
      virtualKey: "google-966377",
      apiKey: process.env["TEST_API_KEY"],
      Authorization: `Bearer ${process.env["TEST_GCLOUD_AUTH_TOKEN"]}`
    }),
    model: process.env["TEST_MODEL_MEDIUM"]!
  }
  const _opts = opts ? { ...opts, ...defaultOpts } : defaultOpts;
  return new Fragola(_opts);
}

const fragola = createTestClient();

const assistant = fragola.agent({
  name: "assistant",
  description: "",
  instructions: "you are a helpful assistant",
  modelSettings: {
    model: fragola.options.model,
    tool_choice: "auto",
    max_tokens: 50000
  }
}).use(mcpClient({
  client: {
    name: "client",
    url: "http://localhost:3000/mcp"
  },
})).use(fileSystemSave("mcp_conv"))
.use(noCompletion)
const { conversation } = await assistant.userMessage({ content: "can you list the clients you have ?" });
console.log(JSON.stringify(conversation, null, 2));