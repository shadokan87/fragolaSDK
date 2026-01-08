import { load } from "@fragola-ai/prompt";
import Prompt from "@fragola-ai/prompt";
import type { FragolaHook } from "../../..";
import { tool } from "@src/fragola";
import { payloadSchema } from "./payloadSchema";
import { fileURLToPath } from 'url';
import path from 'path';
import standard_catalog from "./server_to_client_with_standard_catalog.json";
import payload from "./server_to_client.json";
import Ajv from "ajv";

export const sysPromptKey = "A2ui";
export const A2ui = (): FragolaHook => (agent) => {
    // const __dirname = path.dirname(fileURLToPath(import.meta.url));
    // console.log("dirname", __dirname);
    // const sysPromptPath = path.join(src/hook/presets/protocols/a2ui/systemPrompt.md);
    const sysPrompt = new Prompt(load("src/hook/presets/protocols/a2ui/systemPrompt.md"));
    const ajv = new Ajv();
    const validate = ajv.compile(payload);
    const setCatalog = (catalog: string[]) => {
        sysPrompt.
    };
    agent.context.setInstructions(sysPrompt.value, sysPromptKey);
    agent.context.updateTools((prev) => {
        return [
            ...prev,
            tool({
                name: "emit_A2ui_payload",
                description: "emits an A2ui payload",
                schema: JSON.stringify(payload),
                handler: (params) => {
                    // console.log()
                    const validationResult = validate(params);
                    console.log(JSON.stringify(validationResult, null, 2));
                    return "success"
                }
            })
        ]
    })
    return () => {
        agent.context.removeInstructions(sysPromptKey);
        agent.context.updateTools(prev => (prev.filter(tool => tool.name !== "A2ui_payload")))
    }
}