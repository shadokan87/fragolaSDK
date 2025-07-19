import OpenAI from "openai/index.js"
import type { Tool } from "./fragola"
import type { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.js"
import { type ClientOptions } from "openai"
import { zodToJsonSchema } from "openai/_vendor/zod-to-json-schema/zodToJsonSchema.mjs"
import { streamChunkToMessage } from "./utils"
import { FragolaError } from "./exceptions"
import type z from "zod"
import type { maybePromise, Prettify } from "./types"
import { Store } from "./store"

export type StoreLike<T> = T extends Record<string, any> ? T : never;

export const createStore = <T>(data: StoreLike<T>) => new Store(data);

export type runEventType =
    "conversationUpdate";
    // |
    // "streamStart"
    // | "streamChunk"
    // | "streamEnd";
    //@prettier-ignore
    export type runHookCallBackMap = {
        [K in runEventType]
        : K extends "conversationUpdate" ? (conversation: OpenAI.ChatCompletionMessageParam[]) => maybePromise<void>: never }

export type AgentOpt<TStore = {}> = {
    store?: Store<StoreLike<TStore>>,
    name: string,
    instructions: string,
    tools?: Tool<any>[],
    modelSettings: Prettify<Omit<ChatCompletionCreateParamsBase, "messages" | "tools">>
}

export type AgentState = {
    conversation: OpenAI.ChatCompletionMessageParam[],
    controller?: AbortController
}

export class Agent<TGlobalStore = {}, TStore = {}> {
    public static defaultAgentState: AgentState = {
        conversation: []
    }

    private openai: OpenAI;
    private paramsTools: ChatCompletionCreateParamsBase["tools"] = [];

    constructor(private opts: AgentOpt<TStore>, private globalStore: Store<StoreLike<TGlobalStore>> | undefined = undefined, openai: OpenAI, private state: AgentState = Agent.defaultAgentState) {
        this.openai = openai;
        this.toolsToModelSettingsTools();
    }

    private toolsToModelSettingsTools() {
        const result: ChatCompletionCreateParamsBase["tools"] = [];
        this.opts.tools?.forEach(tool => {
            result.push({
                type: "function",
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: zodToJsonSchema(tool.schema)
                }

            })
        });
        this.paramsTools = result;
    }

    private appendMessages(messages: OpenAI.ChatCompletionMessageParam[], replaceLast: boolean = false) {
        this.updateConversation((prev) => {
            if (replaceLast)
                return [...prev.slice(0, -1), ...messages];
            return [...prev, ...messages]
        });
    }

    private updateState(callback: (prev: typeof this.state) => typeof this.state) {
        this.state = callback(this.state);
    }

    private updateConversation(callback: (prev: AgentState["conversation"]) => AgentState["conversation"]) {
        this.updateState((prev) => ({ ...prev, conversation: callback(this.state.conversation) }));
    }

    private async recursiveAgent(iter = 0): Promise<void> {
        if (iter == 5) {
            console.error("max iter");
            return;
        }
        this.updateState((prev) => ({ ...prev, controller: new AbortController() }));
        let streamBody: ChatCompletionCreateParamsBase = { ...this.opts.modelSettings, messages: [{ role: "system", content: this.opts.instructions }, ...this.state.conversation] };
        if (this.paramsTools?.length)
            streamBody["tools"] = this.paramsTools;
        const stream = await this.openai.chat.completions.create(streamBody, { signal: this.state.controller?.signal });
        let aiMessage: Partial<OpenAI.Chat.ChatCompletionMessageParam> = {};
        if (Symbol.asyncIterator in stream) {
            let replaceLast = false;

            // Streaming
            for await (const chunk of stream) {
                aiMessage = streamChunkToMessage(chunk, aiMessage);
                this.appendMessages([aiMessage as OpenAI.Chat.ChatCompletionMessageParam], replaceLast);
                replaceLast = true;
            }

            // Tool calls
            if (aiMessage.role == "assistant" && aiMessage.tool_calls && aiMessage.tool_calls.length) {
                await Promise.all(aiMessage.tool_calls.map(async toolCall => {
                    // Find tool in project that matches the tool requested by last ai message
                    const tool = this.opts.tools?.find(tool => tool.name == toolCall.function.name);
                    if (!tool) {
                        console.error(`Tool with name ${toolCall.function.name} not found in project`); //TODO: replace with exception
                        return;
                    }
                    let paramsParsed: z.SafeParseReturnType<any, any> | undefined;
                    if (tool.schema) {
                        paramsParsed = (tool.schema as z.Schema).safeParse(JSON.parse(toolCall.function.arguments));
                        if (!paramsParsed.success) {
                            //TODO: implement retry system for bad arguments
                            throw new FragolaError("Tool arguments parsing fail");
                        }
                    }
                    const handler = (() => {
                        if (tool.handler == "dynamic")
                            return async () => "Success";
                        return tool.handler;
                    })();
                    const content = await handler(paramsParsed?.data, () => this.opts.store as any, () => this.globalStore as any);
                    const message: OpenAI.ChatCompletionMessageParam = {
                        role: "tool",
                        content: JSON.stringify(content),
                        tool_call_id: toolCall.id
                    }
                    this.updateConversation((prev) => [...prev, message]);
                }));
                return await this.recursiveAgent(iter + 1);
            }
        }
    }

    async userMessage(message: Omit<OpenAI.Chat.ChatCompletionUserMessageParam, "role">): Promise<AgentState> {
        this.updateConversation((prev) => [...prev, { role: "user", ...message }]);
        await this.recursiveAgent();
        return this.state;
    }
}