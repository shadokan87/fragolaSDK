import z from "zod";
import { Agent, type AgentContext, type CreateAgentOptions } from "./agent";
import type { maybePromise, StoreLike } from "./types";
import type { ClientOptions } from "openai/index.js";
import OpenAI from "openai/index.js";
import type { Store } from "./store";

export type ToolHandlerReturnTypeNonAsync = any[] | Record<any, any> | Function | number | bigint | boolean | string;
export type ToolHandlerReturnType = maybePromise<ToolHandlerReturnTypeNonAsync>;
export type AllowedMetaKeys = "user" | "ai" | "tool";

/**
 * Restricts metadata definition to only "user", "ai", and "tool" keys.
 * Any other keys will be omitted from the resulting type.
 */
export type DefineMetaData<T extends Partial<Record<AllowedMetaKeys, any>>> = {
    [K in keyof T as K extends AllowedMetaKeys ? K : never]: T[K]
};

export type ChatCompletionUserMessageParam<MetaData extends { user?: any } = {}> = OpenAI.Chat.ChatCompletionUserMessageParam & { meta?: MetaData["user"] };

export type ChatCompletionAssistantMessageParam<MetaData extends { ai?: any } = {}> = OpenAI.Chat.ChatCompletionAssistantMessageParam & { meta?: MetaData["ai"] };

export type ChatCompletionToolMessageParam<MetaData extends { tool?: any } = {}> = OpenAI.Chat.ChatCompletionToolMessageParam & { meta?: MetaData["tool"] };

export type MessageMeta<TMetaData extends DefineMetaData<any>, TKey extends AllowedMetaKeys> = TMetaData extends { [K in TKey]?: any } ? TMetaData[TKey] : never;

export type ChatCompletionMessageParam<TMetaData extends DefineMetaData<any> = {}> = ChatCompletionUserMessageParam<MessageMeta<TMetaData, "user">>
    | ChatCompletionAssistantMessageParam<MessageMeta<TMetaData, "ai">>
    | ChatCompletionToolMessageParam<MessageMeta<TMetaData, "tool">>
    | OpenAI.Chat.Completions.ChatCompletionDeveloperMessageParam
    | OpenAI.Chat.Completions.ChatCompletionSystemMessageParam
    | OpenAI.Chat.Completions.ChatCompletionFunctionMessageParam
    ;

export interface Tool<T extends z.ZodType<any, any> = any> {
    /**
     * The name of the tool.
     */
    name: string;
    /**
     * A detailed description of the tool's purpose.
     */
    description: string;
    /**
     * The function that handles the tool's logic, or the string "dynamic" for dynamic handlers.
     */
    handler: ((parameters: z.infer<T>, context: AgentContext<any, any>) => ToolHandlerReturnType) | "dynamic";
    /**
     * The Zod schema that validates the parameters for the tool.
     */
    schema?: T;
}

export const tool = <T extends z.ZodType<any, any>>(params: Tool<T>) => params;

export function stripMeta<T extends object>(data: (T & { meta?: any }) | Array<T & { meta?: any }>) {
    const _strip = (message: T & { meta?: any }) => {
        const { meta, ...messageWithoutMeta } = message;
        return messageWithoutMeta;
    };
    if (Array.isArray(data))
        return data.map(msg => _strip(msg));
    return _strip(data);
}

export const stripConversationMeta = (conversation: ChatCompletionMessageParam[]): OpenAI.ChatCompletionMessageParam[] => stripMeta(conversation) as OpenAI.ChatCompletionMessageParam[];

export const stripAiMessageMeta = (aiMessage: ChatCompletionAssistantMessageParam): OpenAI.ChatCompletionAssistantMessageParam => stripMeta(aiMessage) as OpenAI.ChatCompletionAssistantMessageParam;

export const stripUserMessageMeta = (userMessage: ChatCompletionUserMessageParam): OpenAI.ChatCompletionUserMessageParam => stripMeta(userMessage) as OpenAI.ChatCompletionUserMessageParam;

export const stripToolMessageMeta = (toolMessage: ChatCompletionToolMessageParam): OpenAI.ChatCompletionToolMessageParam => stripMeta(toolMessage) as OpenAI.ChatCompletionToolMessageParam;

export class Fragola<TGlobalStore = {}> {
    private openai: OpenAI;
    constructor(clientOptions?: ClientOptions, private globalStore: Store<TGlobalStore> | undefined = undefined) {
        this.openai = clientOptions ? new OpenAI(clientOptions) : new OpenAI();
    }

    agent<TMetaData extends DefineMetaData<any> = {}, TStore = {}>(opts: CreateAgentOptions<TStore>): Agent<TMetaData, TGlobalStore, TStore> {
        return new Agent<TMetaData, TGlobalStore, TStore>(opts, this.globalStore, this.openai);
    }
}