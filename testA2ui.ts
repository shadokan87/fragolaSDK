import { Fragola, tool, type ClientOptions } from "@src/fragola";
import { mcpClient } from "@src/hook/presets/mcpClient";
import { createHeaders, PORTKEY_GATEWAY_URL } from 'portkey-ai';
import { fileSystemSave } from "./src/hook/presets"
import { noCompletion } from "@src/utils";
import { restaurantsSample } from "@src/hook/presets/protocols/a2ui/sampledata/restaurants";
import { A2ui, type CatalogItem } from "@src/hook/presets/protocols/a2ui/a2ui";
import catalog_json from "./src/hook/presets/protocols/a2ui/server_to_client_with_standard_catalog.json";
import{ $ }from "bun";
import { writeFile } from 'fs/promises';
import { List, Button, Row, Text, TextField, Column, Card } from "@src/hook/presets/protocols/a2ui/standard_catalog";

const catalogItems: CatalogItem[] = [
  { name: "List", description: "A list component for displaying collections of items", item: List },
  { name: "Button", description: "A clickable button component", item: Button },
  { name: "Row", description: "A horizontal layout container", item: Row },
  { name: "Text", description: "A text display component", item: Text },
  { name: "TextField", description: "An input field for text entry", item: TextField },
  { name: "Column", description: "A vertical layout container", item: Column },
  { name: "Card", description: "A card container component", item: Card },
];


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
// const catalog = catalog_json;
// const standard_catalog = catalog["properties"]["surfaceUpdate"]["properties"]["components"]["items"]["properties"]["component"]["properties"];
// const path = "/home/motoure/fragolaSDK/src/hook/presets/protocols/a2ui/standard_catalog";
// for (const [key, value] of Object.entries(standard_catalog)) {
//   // console.log(JSON.stringify([key, value], null, 2));
//   await writeFile(`${path}/${key}.json`, JSON.stringify(value, null, 2));
//   // process.exit(0);
// }
// // console.log(JSON.stringify(catalog["properties"]["surfaceUpdate"]["properties"]["components"]["items"]["properties"]["component"]["properties"], null, 2));
// process.exit(0);
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
.use(A2ui({
  catalog: catalogItems
}));
console.log("!sys", assistant.context.getInstructions());
// const { messages } = await assistant.userMessage({ content: `generate an ui to display this list of restaurant, the user must be able to search and filter by location, price etc. restaurants: ${JSON.stringify(restaurantsSample)}` });
// console.log(JSON.stringify(messages, null, 2));