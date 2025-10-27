import { fileSystemSave } from "@src/hookPreset";
import { Fragola, type DefineMetaData } from "./src/fragola";
import z from "zod";
import type { JsonQuery } from "@src/agent";

const fragola = new Fragola({
    baseURL: process.env.TEST_BASEURL,
    apiKey: process.env.TEST_API_KEY
});

const agent = fragola.agent({
    name: "assistant",
    instructions: "you are a helpful assistant",
    modelSettings: {
        model: "grok-4-fast-reasoning"
    }
}).use(fileSystemSave("./testHook"));

// await agent.userMessage({content: "say hello" });
const schema = z.object({
    name: z.string().optional(),
    location: z.string().describe("where the person is located").optional(),
    profession: z.string().describe("the person profession").optional(),
    age: z.number()
});

const jsonQuery: JsonQuery = {
    name: "user information",
    content: "I am Eclipse, I live in paris. I am a software engineer working on an open source project",
    description: "extract the user informations",
    schema,
    strict: true,
};

const response = await agent.json(jsonQuery);
console.log(JSON.stringify(response, null, 2));