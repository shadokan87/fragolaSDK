import z from "zod";
import { Agent, type AgentOptions, type CreateAgentOptions, type JsonQuery } from "./agent";
import type { maybePromise, StoreLike } from "./types";
import type { ClientOptions } from "openai/index.js";
import OpenAI from "openai/index.js";
import type { Store } from "./store";
import { BadUsage } from "./exceptions";
import type { AgentContext } from "./agentContext";

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
        void meta;
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

const presetBadUsageMessage = `Nor 'preferedModel' or 'modelSettings.model' provided, 1 of both values are required for presets.`;

export type JsonOptions<T extends z.ZodTypeAny = z.ZodTypeAny> = {
    message: string;
    /** A Zod schema describing the expected JSON shape returned by the AI/tool */
    schema: T;
    /** prefer calling a tool instead of using the AI completion */
    preferToolCall?: boolean;
    /** optional model settings passthrough */
    modelSettings?: AgentOptions["modelSettings"];
};

type PreferedModel = {
    /**
     * The model that will be used by default unless overridden in modelSettings.
     */
    model: string
}

export const FRAGOLA_FRIEND = Symbol("Fragola_friend")

export class Fragola<TGlobalStore extends StoreLike<any> = {}> {
    private openai: OpenAI;
    private namespaceStore: Map<string, Store<any>> = new Map();
    constructor(private clientOptions: ClientOptions & PreferedModel, private globalStore: Store<TGlobalStore> | undefined = undefined) {
        const opts = clientOptions ? (() => {
            const copy = { ...clientOptions };
            const { model, ...rest } = copy;
            return rest;
        })() : undefined;
        this.openai = opts ? new OpenAI(opts) : new OpenAI();
    }
    [FRAGOLA_FRIEND] = {
        getGlobalStore: <T extends StoreLike<any>>(namespace?: string): Store<T> | undefined => {
            let store = namespace ? this.namespaceStore.get(namespace) : this.globalStore;
            if (store)
                return store as unknown as Store<T>;
            return undefined;
        }
    }


    agent<TMetaData extends DefineMetaData<any> = {}, TStore = {}>(opts: CreateAgentOptions<TStore>): Agent<TMetaData, TGlobalStore, TStore> {
        return new Agent<TMetaData, TGlobalStore, TStore>(opts, this.globalStore, this.openai, undefined, this as Fragola<any>);
    }

    get options() {
        return this.clientOptions;
    }

    async boolean(evaluate: string): Promise<boolean> {
        const booleanSchema = z.object({
            bool: z.boolean(),
        });

        const query: JsonQuery = {
            name: "evaluate_statement",
            content: evaluate,
            description: "provide your answer for the 'bool' value",
            schema: booleanSchema
        };
        const response = await this.json(query, {
            name: "BooleanEvaluator",
            description: "Preset agent that outputs a single JSON field {bool: boolean} indicating truthiness of the 'evaluate' statement.",
            instructions: [
                "You evaluate structured checks of the form '<Claim>: <user_input>'.",
                "Return ONLY a JSON object with the following shape: {\"bool\": boolean}.",
                "No extra text, no markdown, no explanations.",
                "Interpretation rule: 'bool' is true when the claim accurately describes <user_input>; otherwise false.",
                "Ambiguous/unknown -> false.",
                "Examples:",
                "- Input: 'This topic is about mathematics: what is 2 + 2?' -> {\"bool\": true}",
                "- Input: 'This topic is about mathematics: write a love poem' -> {\"bool\": false}",
                "- Input: 'This input contains slurs: [slur], get out of here! You are not welcome' -> {\"bool\": true}",
                "- Input: 'This input contains slurs: have a great day' -> {\"bool\": false}",
                "- Input: 'The topic is non professional: let's talk about weekend plans' -> {\"bool\": true}",
                "- Input: 'The topic is non professional: how to deploy a Kubernetes cluster' -> {\"bool\": false}",
                "- Input: 'This input contains profanity: what the hell is this?' -> {\"bool\": true}",
                "- Input: 'This input contains profanity: good morning team' -> {\"bool\": false}",
                "- Input: 'This input contains PII: My SSN is 123-45-6789' -> {\"bool\": true}",
                "- Input: 'This input contains PII: The sky is blue' -> {\"bool\": false}",
                "- Input: 'This input is spam: CLICK HERE for FREE $$$ now!!!' -> {\"bool\": true}",
                "- Input: 'This input is spam: Could you review my PR?' -> {\"bool\": false}",
                "- Input: 'This input is NSFW: explicit sexual content' -> {\"bool\": true}",
                "- Input: 'This input is NSFW: how to write unit tests' -> {\"bool\": false}",
                "- Input: 'This topic is about politics: Presidential election polling analysis' -> {\"bool\": true}",
                "- Input: 'This topic is about politics: calculate the derivative of x^2' -> {\"bool\": false}",
                "- Input: 'This topic is about health: best practices for sleep hygiene' -> {\"bool\": true}",
                "- Input: 'This topic is about health: sorting algorithms' -> {\"bool\": false}",
                "- Input: 'This input promotes self-harm: I want to hurt myself' -> {\"bool\": true}",
                "- Input: 'This input promotes self-harm: I enjoy hiking' -> {\"bool\": false}",
                "- Input: 'This input contains threats: I will hurt you' -> {\"bool\": true}",
                "- Input: 'This input contains threats: Please take care' -> {\"bool\": false}",
            ].join("\n"),
        });
        return response.success ? response.data.bool : false;
    }

    async json<S extends z.ZodTypeAny = z.ZodTypeAny>(query: JsonQuery<S>, options: CreateAgentOptions | undefined = undefined): Promise<z.SafeParseReturnType<unknown, z.infer<S>>> {
        if (!this.clientOptions?.model) {
            throw new BadUsage(presetBadUsageMessage);
        }

        const { state, ...rest } = await this.agent(options ?? {
            name: "JsonExtraction",
            instructions: "You will be given a user message with instructions to extract informations into json format.",
            description: "Simple agent to extract data from text to json"
        }).json(query);
        return rest;
    }
}