import { Store } from "./store"
import type { Tool } from "./fragola"
import type { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.js"
import { type ClientOptions } from "openai"
import { zodToJsonSchema } from "openai/_vendor/zod-to-json-schema/zodToJsonSchema.mjs"
import { streamChunkToMessage } from "./utils"
import { FragolaError } from "./exceptions"
import type z from "zod"
import type { Prettify, StoreLike } from "./types"
import { OpenAI } from "openai/index.js"
import type { AgentEventId, AgentDefaultEventId, AgentBeforeEventId, EventDefaultCallback, AgentAfterEventId } from "./event"
import type { ConversationUpdateCallback, callbackMap as eventDefaultCallbackMap } from "./eventDefault";
import type { BeforeConversationUpdateCallback, callbackMap as eventBeforeCallbackMap } from "./eventBefore";
import { nanoid } from "nanoid"
import type { AfterConversationUpdateCallback, callbackMap as eventAfterCallbackMap } from "./eventAfter"

export const createStore = <T>(data: StoreLike<T>) => new Store(data);

export type AgentState = {
    conversation: OpenAI.ChatCompletionMessageParam[],
    stepCount: number
}

export type AgentOpt<TStore extends StoreLike<any> = {}> = {
    store?: Store<TStore>,
    name: string,
    instructions: string,
    tools?: Tool<any>[],
    modelSettings: Prettify<Omit<ChatCompletionCreateParamsBase, "messages" | "tools">>
}

/**
 * Maps an event ID to its corresponding callback type based on the event category.
 *
 * - For default event IDs (`AgentDefaultEventId`), returns the callback type from `eventDefaultCallbackMap`.
 * - For before event IDs (`AgentBeforeEventId`), returns the callback type from `eventBeforeCallbackMap` using the provided global and local store types.
 * - For other event IDs, resolves to `never`.
 *
 * @template TEventId - The type of the event ID.
 * @template TGlobalStore - The type of the global store.
 * @template TStore - The type of the local store.
 */
type eventIdToCallback<TEventId extends AgentEventId, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> =
    TEventId extends AgentDefaultEventId ? eventDefaultCallbackMap<TGlobalStore, TStore>[TEventId] :
    TEventId extends AgentBeforeEventId ? eventBeforeCallbackMap<TGlobalStore, TStore>[TEventId] :
    TEventId extends AgentAfterEventId ? eventAfterCallbackMap<TGlobalStore, TStore>[TEventId] :
    never

type registeredEvent<TEventId extends AgentEventId, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
    id: string,
    callback: eventIdToCallback<TEventId, TGlobalStore, TStore>
}

export class Agent<TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> {
    public static defaultAgentState: AgentState = {
        conversation: [],
        stepCount: 0
    }

    private openai: OpenAI;
    private paramsTools: ChatCompletionCreateParamsBase["tools"] = [];
    private registeredEvents: Map<AgentEventId, registeredEvent<AgentEventId, TGlobalStore, TStore>[]> = new Map();
    // Tmp values for applyEvents method
    private conversationTmp: AgentState["conversation"] | undefined = undefined;

    constructor(private opts: AgentOpt<TStore>, private globalStore: Store<TGlobalStore> | undefined = undefined, openai: OpenAI, private state: AgentState = Agent.defaultAgentState) {
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

    private async appendMessages(messages: OpenAI.ChatCompletionMessageParam[], replaceLast: boolean = false) {
        await this.updateConversation((prev) => {
            if (replaceLast)
                return [...prev.slice(0, -1), ...messages];
            return [...prev, ...messages]
        });
    }

    private updateState(callback: (prev: typeof this.state) => typeof this.state) {
        this.state = callback(this.state);
    }

    private async updateConversation(callback: (prev: AgentState["conversation"]) => AgentState["conversation"]) {
        await this.applyEvents("before:conversationUpdate");
        this.conversationTmp = callback(this.state.conversation);
        const newConversation = await this.applyEvents("conversationUpdate");
        this.conversationTmp = undefined;
        this.updateState((prev) => ({ ...prev, conversation: newConversation }));
    }

    private async recursiveAgent(iter = 0): Promise<void> {
        if (iter == 5) {
            console.error("max iter");
            return;
        }
        const abortController = new AbortController();
        let requestBody: ChatCompletionCreateParamsBase = {
            ...this.opts.modelSettings,
            messages: [{ role: "system", content: this.opts.instructions }, ...this.state.conversation]
        };
        if (this.paramsTools?.length)
            requestBody["tools"] = this.paramsTools;

        const response = await this.openai.chat.completions.create(requestBody, { signal: abortController.signal });
        let aiMessage: OpenAI.Chat.ChatCompletionMessageParam;

        // Handle streaming vs non-streaming
        if (Symbol.asyncIterator in response) {
            let partialMessage: Partial<OpenAI.Chat.ChatCompletionMessageParam> = {};
            let replaceLast = false;

            for await (const chunk of response) {
                partialMessage = streamChunkToMessage(chunk, partialMessage);
                await this.appendMessages([partialMessage as OpenAI.Chat.ChatCompletionMessageParam], replaceLast);
                replaceLast = true;
            }
            aiMessage = partialMessage as OpenAI.Chat.ChatCompletionMessageParam;
        } else {
            aiMessage = response.choices[0].message as OpenAI.Chat.ChatCompletionMessageParam;
            await this.appendMessages([aiMessage]);
        }

        // Handle tool calls if present
        if (aiMessage.role === "assistant" && aiMessage.tool_calls && aiMessage.tool_calls.length) {
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
                // execute handler function
                const handler = (() => {
                    if (tool.handler == "dynamic")
                        return async () => "Success";
                    return tool.handler;
                })();
                const isAsync = handler.constructor.name === "AsyncFunction";
                const content = isAsync
                    ? await handler(paramsParsed?.data, () => this.opts.store as any, () => this.globalStore as any)
                    : handler(paramsParsed?.data, () => this.opts.store as any, () => this.globalStore as any);

                // add tool message to conversation
                const message: OpenAI.ChatCompletionMessageParam = {
                    role: "tool",
                    content: JSON.stringify(content),
                    tool_call_id: toolCall.id
                }
                await this.updateConversation((prev) => [...prev, message]);
            }));
            return await this.recursiveAgent(iter + 1);
        }
    }

    async userMessage(message: Omit<OpenAI.Chat.ChatCompletionUserMessageParam, "role">): Promise<AgentState> {
        await this.updateConversation((prev) => [...prev, { role: "user", ...message }]);
        await this.recursiveAgent();
        return this.state;
    }

    private async applyEvents<TEventId extends AgentEventId>(eventId: TEventId): Promise<ReturnType<eventIdToCallback<TEventId, TGlobalStore, TStore>>> {
        const events = this.registeredEvents.get(eventId);
        if (!events)
            return undefined as ReturnType<eventIdToCallback<TEventId, TGlobalStore, TStore>>;
        for (let i = 0; i < events.length; i++) {
            const callback = events[i].callback;
            const defaultParams: Parameters<EventDefaultCallback<TGlobalStore, TStore>> = [this.state, () => this.opts.store, () => this.globalStore];
            switch (eventId) {
                case "before:conversationUpdate": {
                    let params: Parameters<EventDefaultCallback<TGlobalStore, TStore>> = defaultParams;
                    if (callback.constructor.name == "AsyncFunction") {
                        return await (callback as EventDefaultCallback<TGlobalStore, TStore>)(...params) as any;
                    } else {
                        return (callback as EventDefaultCallback<TGlobalStore, TStore>)(...params) as any;
                    }
                }
                case "conversationUpdate": {
                    let params: Parameters<ConversationUpdateCallback<TGlobalStore, TStore>> = [this.conversationTmp || [], ...defaultParams];
                    if (callback.constructor.name == "AsyncFunction") {
                        return await (callback as ConversationUpdateCallback<TGlobalStore, TStore>)(...params) as any;
                    } else {
                        return (callback as ConversationUpdateCallback<TGlobalStore, TStore>)(...params) as any;
                    }
                }
                default: {
                    throw new FragolaError(`Internal error: event with name '${eventId}' is unknown`)
                }
            }
        }
        return undefined as ReturnType<eventIdToCallback<TEventId, TGlobalStore, TStore>>;
    }

    /**
     * Registers a callback for a specific agent event.
     *
     * @template TEventId - The type of the event ID (must extend AgentEventId).
     * @param eventId - The event identifier to listen for.
     * @param callback - The callback function to invoke when the event occurs. The callback type is inferred from the event ID and store types.
     * @returns A function to unregister the event listener.
     *
     * @example
     * // Register a callback for a custom event
     * const unregister = agent.on("before:conversationUpdate", (state, getStore, getGlobalStore) => {
     *   // handle event
     * });
     * // Later, to remove the listener:
     * unregister();
     */
    on<TEventId extends AgentEventId>(eventId: TEventId, callback: eventIdToCallback<TEventId, TGlobalStore, TStore>
    ) {
        type EventTargetType = registeredEvent<TEventId, TGlobalStore, TStore>;
        let events = this.registeredEvents.get(eventId) || [] as EventTargetType[];
        const id = nanoid();
        events.push({
            id,
            callback: callback
        });
        this.registeredEvents.set(eventId, events);

        return () => {
            let events = this.registeredEvents.get(eventId);
            if (!events)
                return;
            events = events.filter(event => event.id != id);
            if (!events.length)
                this.registeredEvents.delete(eventId);
            else
                this.registeredEvents.set(eventId, events);
        }
    }

    /**
     * Registers a callback to be invoked before the "conversationUpdate" event is processed.
     * This allows inspection or modification of the agent state prior to updating the conversation.
     * @typescript
     * Is a default event, see {@link EventDefaultCallback} for callback signature details.
     * 
     * @param callback - The function to execute before the conversation update event.
     *   Receives:
     *     - state: The current agent state.
     *     - getStore: A function returning the local store instance or undefined.
     *     - getGlobalStore: A function returning the global store instance or undefined.
     * @returns A function to unregister the event listener.
     *
     * @example
     * agent.onBeforeConversationUpdate((state, getStore, getGlobalStore) => {
     *     console.log("before conversation update: ", state.conversation.at(-1)?.content);
     * });
     */
    onBeforeConversationUpdate(callback: BeforeConversationUpdateCallback<TGlobalStore, TStore>) { return this.on("before:conversationUpdate", callback); }

    onAfterConversationUpdate(callback: AfterConversationUpdateCallback<TGlobalStore, TStore>) { return this.on("after:conversationUpdate", callback) }

    /**
     * Registers a callback for the "conversationUpdate" event.
     *
     * @param callback - Function that receives:
     *   - newConversation: The updated conversation messages.
     *     - state: The current agent state.
     *     - getStore: A function returning the local store instance or undefined.
     *     - getGlobalStore: A function returning the global store instance or undefined.
     * @returns the updated conversation messages (array or Promise).
     *
     * @example
     * agent.onConversationUpdate((newConversation, state, getStore, getGlobalStore) => {
     *   // Modify the last message before returning
     *   if (newConversation.length > 0) {
     *     newConversation[newConversation.length - 1].content += " (modified)";
     *   }
     *   return newConversation;
     * });
     */
    onConversationUpdate(callback: ConversationUpdateCallback<TGlobalStore, TStore>) { return this.on("conversationUpdate", callback) }
}