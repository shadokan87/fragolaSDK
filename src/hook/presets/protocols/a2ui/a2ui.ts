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
import { createStore } from "@src/store";
import type { variables as sysPromptVariables } from "./systemPrompt.types";

export const sysPromptKey = "A2ui";
export type CatalogItem = { name: string, description: string, item: string | Record<string, unknown> };
export type setCatalogCallback = (prev: CatalogItem[]) => CatalogItem[];

export interface a2uiStore {
    catalog: CatalogItem[]
    setCatalog: (cb: setCatalogCallback) => void
}
export interface a2uiOptions {
    catalog?: CatalogItem[],
    method?: "toolcal"
}

export const A2ui = (options?: a2uiOptions): FragolaHook => (agent) => {
    const sysPrompt = new Prompt(load("src/hook/presets/protocols/a2ui/systemPromptToolCall.md"), {
        "components_catalog": "(no components available)"
    } as sysPromptVariables);
    const ajv = new Ajv();
    const validate = ajv.compile(payload);
    let catalogString: string[] = [];
    let catalogChanged: boolean = false;
    const setCatalog = (cb: setCatalogCallback) => {
        store.update((data) => {
            const newCatalog = cb(data.catalog);
            if (!newCatalog.length)
                catalogString = [];
            else
                catalogString = newCatalog.map((item) => (typeof item == 'string') ? item : JSON.stringify(item.item));
            catalogChanged = true;
            return {
                ...data,
                catalog: newCatalog
            }
        })
    };

    const store = createStore<a2uiStore>({
        catalog: [],
        setCatalog: setCatalog
    });

    const processCatalog = (catalog: CatalogItem[]) => {
        sysPrompt.setVariables({
            "components_catalog": catalog.map(item => {
                return `### ${item.name}\n\n${item.description}\n\n\`\`\`json\n${JSON.stringify(item.item, null, 2)}\n\`\`\``;
            }).join('\n\n---\n\n')
        } as sysPromptVariables);
        agent.context.setInstructions(sysPrompt.value, sysPromptKey);
        catalogChanged = false;
    }

    if (options && options.catalog != undefined && options.catalog.length > 0) {
        processCatalog(options.catalog)
    }

    store.onChange((data) => {
        if (catalogChanged) {
            processCatalog(data.catalog)
        }
    });

    agent.context.setInstructions(sysPrompt.value, sysPromptKey);
    agent.context.updateTools((prev) => {
        return [
            ...prev,
            tool({
                name: "emit_A2ui_payload",
                description: "emits an A2ui payload",
                schema: JSON.stringify(payload),
                handler: (params) => {
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