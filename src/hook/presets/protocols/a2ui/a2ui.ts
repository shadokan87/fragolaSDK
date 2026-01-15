import { load } from "@fragola-ai/prompt";
import Prompt from "@fragola-ai/prompt";
import type { FragolaHook } from "../../..";
import { tool } from "@src/fragola";
import payload from "./server_to_client.json";
import Ajv from "ajv";
import { createStore } from "@src/store";
import type { variables as sysPromptVariables } from "./systemPrompt.types";

export const a2uiNamespace = "A2ui";
export const catalogPromptPlaceholder = "components_catalog";
export type CatalogItem = { name: string, description: string, item: string | Record<string, unknown> };
export type setCatalogCallback = (prev: CatalogItem[]) => CatalogItem[];

export interface a2uiStore {
    catalog: CatalogItem[]
    setCatalog: (cb: setCatalogCallback) => void
}

export interface a2uiOptions {
    catalog?: CatalogItem[],
    method?: "toolcal",
    sysPrompt?: Prompt
}

export const A2ui = (options?: a2uiOptions): FragolaHook => (agent) => {
    const sysPrompt = options?.sysPrompt ?? new Prompt(load("src/hook/presets/protocols/a2ui/systemPromptToolCall.md"), {
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
                catalogString = newCatalog.map((item) => (typeof item == 'string') ? item : JSON.stringify(item.item, null, 2));
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
    }, a2uiNamespace);

    agent.context.addStore(store);

    const processCatalog = (catalog: CatalogItem[]) => {
        sysPrompt.setVariables({
            [catalogPromptPlaceholder]: catalog.map((item, index) => {
                return `### ${item.name}\n\n${item.description}\n\n\`\`\`json\n${catalogString[index]}\n\`\`\``;
            }).join('\n\n---\n\n')
        } as sysPromptVariables);
        agent.context.setInstructions(sysPrompt.value, a2uiNamespace);
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

    agent.context.setInstructions(sysPrompt.value, a2uiNamespace);
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
        agent.context.removeInstructions(a2uiNamespace);
        agent.context.removeStore(a2uiNamespace);
        agent.context.updateTools(prev => (prev.filter(tool => tool.name !== "A2ui_payload")));
    }
}