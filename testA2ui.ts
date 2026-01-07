import { Fragola, tool, type ClientOptions } from "@src/fragola";
import { mcpClient } from "@src/hook/presets/mcpClient";
import { createHeaders, PORTKEY_GATEWAY_URL } from 'portkey-ai';
import { fileSystemSave } from "./src/hook/presets"
import { noCompletion } from "@src/utils";
import { restaurantsSample } from "@src/hook/presets/protocols/a2ui/sampledata/restaurants";
import { A2ui } from "@src/hook/presets/protocols/a2ui/a2ui";

const createTestClient = (opts?: ClientOptions) => {
  const defaultOpts: ClientOptions = {
    baseURL: PORTKEY_GATEWAY_URL,
    apiKey: "xxx",
    defaultHeaders: createHeaders({
      virtualKey: "google-966377",
      apiKey: process.env["TEST_API_KEY"],
      Authorization: `Bearer ${process.env["TEST_GCLOUD_AUTH_TOKEN"]}`
    }),
    model: process.env["TEST_MODEL_MEDIUM"]!,
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
    max_tokens: 50000,
    stream: true
  }
}).use(fileSystemSave("./a2ui_restaurants"))
.use(A2ui())
const { messages } = await assistant.userMessage({ content: `generate an ui to display this list of restaurant, the user must be able to search and filter by location, price etc. restaurants: ${JSON.stringify(restaurantsSample)}` });
console.log(JSON.stringify(messages, null, 2));