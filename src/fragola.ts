import z from "zod";
import { Agent, type AgentOptions, type CreateAgentOptions, type JsonQuery } from "./agent";
import type { maybePromise, StoreLike } from "./types";
import type { ClientOptions as OpenaiClientOptions } from "openai/index.js";
import OpenAI from "openai/index.js";
import type { Store } from "@src/store";
import { BadUsage } from "./exceptions";
import type { AgentContext } from "@src/agentContext";
import { type AgentAny } from "./agent";

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

export interface Tool<T extends z.ZodType<any, any> | string = any> {
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
    handler: ((parameters: T extends z.ZodType<any, any> ? z.infer<T> : any, context: AgentContext<any, any>) => ToolHandlerReturnType) | "dynamic";
    /**
     * The Zod schema or JSON Schema string that validates/describes the parameters for the tool.
     * - Zod schema: Automatic validation will be performed
     * - String: No validation, you handle validation in the tool handler. The string is passed as-is to the model.
     */
    schema?: T;
}

/**
 * Create a tool for your agent using Zod schema or JSON schema.
 *
 * @example
 * // Example: Weather tool using Zod schema
 * import z from "zod";
 * import { tool } from "./fragola";
 *
 * const getWeather = tool({
 *   name: "getWeather",
 *   description: "Get the current weather for a city.",
 *   schema: z.object({ city: z.string() }),
 *   handler: async ({ city }) => {
 *     // Replace with real API call
 *     return { city, temperature: 22, unit: "C" };
 *   },
 * });
 *
 * // Example: Weather tool using JSON schema string
 * const getWeatherStringSchema = tool({
 *   name: "getWeather",
 *   description: "Get the current weather for a city.",
 *   schema: '{ "type": "object", "properties": { "city": { "type": "string" } }, "required": ["city"] }',
 *   handler: async ({ city }: { city: string }) => {
 *     return { city, temperature: 22, unit: "C" };
 *   },
 * });
 */
export const tool = <T extends z.ZodType<any, any> | string>(params: Tool<T>) => params;

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

export const stripMessagesMeta = (messages: ChatCompletionMessageParam[]): OpenAI.ChatCompletionMessageParam[] => stripMeta(messages) as OpenAI.ChatCompletionMessageParam[];

export const stripAiMessageMeta = (aiMessage: ChatCompletionAssistantMessageParam): OpenAI.ChatCompletionAssistantMessageParam => stripMeta(aiMessage) as OpenAI.ChatCompletionAssistantMessageParam;

export const stripUserMessageMeta = (userMessage: ChatCompletionUserMessageParam): OpenAI.ChatCompletionUserMessageParam => stripMeta(userMessage) as OpenAI.ChatCompletionUserMessageParam;

export const stripToolMessageMeta = (toolMessage: ChatCompletionToolMessageParam): OpenAI.ChatCompletionToolMessageParam => stripMeta(toolMessage) as OpenAI.ChatCompletionToolMessageParam;

const presetBadUsageMessage = `Cannot create a preset agent because no model was configured. Presets need either 'model' on the Fragola client options or 'modelSettings.model' on the preset call so the endpoint request knows which model to use. Set one of those values and retry.`;

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

/**
 * Called after Fragola creates a new agent instance.
 * Can return a promise to perform async setup work.
 * @param agent - The newly created agent.
 */
export type AgentCreatedCallback = (agent: AgentAny) => maybePromise<void>;

/**
 * Lifecycle callbacks emitted by a Fragola instance.
 */
export interface FragolaEvents {
    /**
     * Runs after `fragola.agent(...)` instantiates and returns a new agent.
     */
    agentCreated?: AgentCreatedCallback
}

export type ClientOptions = OpenaiClientOptions & PreferedModel & {events?: FragolaEvents};

export class Fragola<TGlobalStore extends StoreLike<any> = {}> {
    #sdk: typeof OpenAI;
    #sdkInstance: OpenAI;
    #namespaceContext: Map<string, Store<any>> = new Map();
    constructor(private clientOptions: ClientOptions, private globalStore: Store<TGlobalStore> | undefined = undefined, sdk: typeof OpenAI = OpenAI) {
        const opts = clientOptions ? (() => {
            const copy = { ...clientOptions };
            const { model, ...rest } = copy;
            return rest;
        })() : undefined;
        this.#sdk = sdk;
        this.#sdkInstance = opts ? new this.sdk(opts) : new this.sdk();
    }

    /** Returns the OpenAI SDK constructor used by this Fragola instance. */
    get sdk() {
        return this.#sdk;
    }

    /** Returns the OpenAI client instance created from this Fragola configuration. */
    get SdkInstance() {
        return this.#sdkInstance;
    }

    /**
     * Create a new agent attached to this Fragola instance.
     *
     * The returned agent uses this instance's client configuration and can
     * access its global store.
     *
     * @param opts - Agent configuration.
     * @returns A new agent instance.
     *
     * @example
     * ```ts
     * const fragola = new Fragola({
     *   model: "gpt-5.4"
     * });
     *
     * const agent = fragola.agent({
     *   name: "assistant",
     *   description: "Minimal assistant",
     *   instructions: "You are a helpful assistant."
     * });
     * ```
     */
    agent<TMetaData extends DefineMetaData<any> = {}, TStore = {}>(opts: CreateAgentOptions<TStore>): Agent<TMetaData, TGlobalStore, TStore> {
        const created = new Agent<TMetaData, TGlobalStore, TStore>(opts, this.globalStore, this.#sdkInstance, undefined, this as Fragola<any>);
        (async () => {
            if (this.clientOptions.events?.agentCreated) {
                void await this.clientOptions.events.agentCreated(created)
            }
        })();
        return created;
    }

    /** Returns the client options configured on this Fragola instance. */
    get options() {
        return this.clientOptions;
    }

    /** Acess the instance default global store. */
    get store(): Store<TGlobalStore> | undefined {
        return this.globalStore;
    }

    /**
     * Returns the instance (global) store or a namespaced store casted as T.
     * Recommended when accessing the store from outside an agent store.
     * @param namespace - The namespace of the store to access (optional).
     */
    getStore<T extends StoreLike<any> = {}>(namespace?: string): Store<T> | undefined {
        const store = namespace ? this.#namespaceContext.get(namespace) : this.globalStore;
        return store as unknown as Store<T> | undefined;
    }

    /**
     * Add a namespaced store to the Fragola instance so agents can access it via getStore(namespace).
     * @param store - The store to add (must have a namespace defined).
     */
    addStore(store: Store<any>): void {
        if (!store.namespace)
            throw new BadUsage("Cannot add store because the provided store has no namespace. Fragola stores extra stores by namespace so they can be retrieved later with getStore(namespace). Create it with createStore(value, 'your-namespace') before calling addStore().");
        if (this.#namespaceContext.has(store.namespace))
            throw new BadUsage(`Cannot add store with namespace '${store.namespace}' because Fragola already has a store registered under that namespace. Namespaces must be unique within one Fragola instance. Remove the existing store first or use a different namespace.`);
        this.#namespaceContext.set(store.namespace, store);
    }

    /**
     * Remove a namespaced store from the Fragola instance.
     * @param namespace - The namespace of the store to remove
     */
    removeStore(namespace: string): void {
        if (!this.#namespaceContext.has(namespace)) {
            console.warn(`Tried to remove store with namespace '${namespace}' that doesn't exist.`);
            return;
        }
        this.#namespaceContext.delete(namespace);
    }

    /**
     * Runs a one-off JSON extraction with a temporary agent.
     *
     * If `options` is omitted, Fragola creates a minimal extraction agent for
     * this call and returns only the schema parse result.
     *
     * @param query - The extraction prompt and Zod schema.
     * @param options - Optional agent options to use instead of the default extraction agent.
     * @returns The Zod safe-parse result for the assistant response.
     *
     * @example
     * ```ts
     * const result = await fragola.json({
     *   content: "my name is Ada",
     *   name: "extract_person",
     *   schema,
     * });
     *
     * if (result.success) {
     *   console.log(result.data);
     * }
     * ```
     */
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

export {
    type OpenaiClientOptions
}