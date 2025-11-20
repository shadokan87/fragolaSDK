import type OpenAI from "openai";
import type { FragolaHook } from "../";
import { nanoid } from "nanoid";
import fs from "fs/promises";
import nodePath from "path";
import syncFs from "fs";


/**
 * Hook that automatically saves the messages to the file system after each update.
 * 
 * The file is saved with a filename based on the first user message content. When there are conflicting
 * filenames, it will create a nonce to ensure uniqueness. e.g `<label>.json/<label>-<nonce>.json`
 * 
 * @param path - The directory path where messages files will be saved
 * @returns A hook that saves messagess as JSON files
 * 
 * @example
 * ```typescript
 * import { fileSystemSave } from "@fragola-ai/agentic-sdk-core/hook/presets";
 * import { Fragola } from "@fragola-ai/agentic-sdk-core";
 * 
 * const fragola = new Fragola({ ... });
 * 
 * const agent = fragola.agent({
 *     name: "assistant",
 *     instructions: "you are a helpful assistant",
 *     modelSettings: {
 *         model: "gpt-oss-120b"
 *     }
 * }).use(fileSystemSave("./testHook"));
 * 
 * await agent.userMessage({content: "say hello"});
 * // Creates: ./testHook/say hello.json
 * 
 * await agent.userMessage({content: "say hello again"});
 * // Updates: ./testHook/say hello.json (same file, full messages)
 * ```
 */
export const fileSystemSave = (path: string): FragolaHook => {
    return (agent) => {
        let fullPath: string | undefined = undefined;

        agent.onAfterMessagesUpdate(async (reason, context) => {
            if (reason == "partialAiMessage")
                return;
            const { messages } = context.state;
            let firstUserMessage: OpenAI.ChatCompletionUserMessageParam | undefined = undefined;
            for (let i = 0; i < messages.length; i++) {
                if (messages[i].role == "user") {
                    firstUserMessage = messages[i] as OpenAI.ChatCompletionUserMessageParam;
                }
            }
            if (!firstUserMessage)
                return;
            if (!fullPath) {
                const label = (() => {
                    if (typeof firstUserMessage.content == "string") {
                        return firstUserMessage.content.length > 10
                            ? firstUserMessage.content.substring(0, 3) + "..." + firstUserMessage.content.slice(-3)
                            : firstUserMessage.content;
                    } else if (Array.isArray(firstUserMessage.content)) {
                        const textContent = firstUserMessage.content
                            .filter(item => item.type === "text")
                            .map(item => item.text)
                            .join(" ");
                        return textContent.length > 10
                            ? textContent.substring(0, 3) + "..." + textContent.slice(-3)
                            : textContent;
                    }
                    return "<no_label>";
                })();
                fullPath = nodePath.join(path, label);
                if (syncFs.existsSync(fullPath + ".json")) {
                    fullPath = `${fullPath}-${nanoid()}.json`
                } else {
                    fullPath = `${fullPath}.json`
                }
            }
            try {
                await fs.mkdir(path, { recursive: true });
                await fs.writeFile(fullPath, JSON.stringify(messages, null, 2), "utf8");
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error("Failed to save messages:", err);
            }
        });
    };
}