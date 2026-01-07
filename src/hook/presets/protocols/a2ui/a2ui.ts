import { load, Prompt } from "@fragola-ai/prompt";
import type { FragolaHook } from "../../..";
import { tool } from "@src/fragola";
import { payloadSchema } from "./payloadSchema";
import { fileURLToPath } from 'url';
import path from 'path';

export const sysPromptKey = "A2ui";
export const A2ui = (): FragolaHook => (agent) => {
    // const __dirname = path.dirname(fileURLToPath(import.meta.url));
    // console.log("dirname", __dirname);
    // const sysPromptPath = path.join(src/hook/presets/protocols/a2ui/systemPrompt.md);
    const sysPrompt = new Prompt(load("src/hook/presets/protocols/a2ui/systemPrompt.md"));
    agent.context.setInstructions(sysPrompt.value, sysPromptKey);
    agent.context.updateTools((prev) => {
        return [
            ...prev,
            tool({
                name: "A2ui_payload",
                description: "emits an A2ui payload",
                schema: payloadSchema,
                handler: (params) => {
                    // console.log()
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