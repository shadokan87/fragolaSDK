import { Store } from "./store"
import type { Tool } from "./fragola"
import type { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.js"
import { zodToJsonSchema } from "openai/_vendor/zod-to-json-schema/zodToJsonSchema.mjs"
import { streamChunkToMessage, isAsyncFunction } from "./utils"
import { BadUsage, FragolaError, MaxStepHitError } from "./exceptions"
import type z from "zod"
import type { Prettify, StoreLike } from "./types"
import OpenAI from "openai/index.js"
import type { AgentEventId, AgentDefaultEventId, EventDefaultCallback, AgentAfterEventId } from "./event"
import type { CallAPI, CallAPIProcessChuck, ConversationUpdateCallback, callbackMap as eventDefaultCallbackMap, ModelInvocationCallback } from "./eventDefault";
import { nanoid } from "nanoid"
import type { AfterConversationUpdateCallback, AfterStateUpdateCallback, conversationUpdateReason, callbackMap as eventAfterCallbackMap } from "./eventAfter"
import type { ChatCompletionAssistantMessageParam } from "openai/resources"

export const createStore = <T extends StoreLike<any>>(data: StoreLike<T>) => new Store(data);

export type AgentState = {
    conversation: OpenAI.ChatCompletionMessageParam[],
    stepCount: number,
    status: "idle" | "generating" | "waiting",
}

/**
 * Options for controlling the agent's step execution behavior.
 *
 * @see {@link defaultStepOptions} for default values.
 */
export type StepOptions = Partial<{
    /** The maximum number of steps to execute in one call (default: 10). */
    maxStep: number,
    /** Wether or not to reset agent state `stepCount` after each user messages. `true` is recommanded for conversational agents.*/
    resetStepCountAfterUserMessage: boolean,

    //TODO: unanswered tool behaviour fields
    // /** Determines how to handle unanswered tool calls: `answer` to process them, `skip` to ignore (default: "answer"). */
    unansweredToolBehaviour: "answer" | "skip",
    // /** The string to use when skipping a tool call (default: "(generation has been canceled, you may ignore this tool output)"). */
    skipToolString: string
}>;

/**
 * @typescript The default values for {@link StepOptions}.
 *
 * @property maxStep - Default: 10. The maximum number of steps to execute in one call.
 * @property unansweredToolBehaviour - Default: "answer". Determines how to handle unanswered tool calls.
 * @property skipToolString - Default: "(generation has been canceled, you may ignore this tool output)". The string to use when skipping a tool call.
 */
export const defaultStepOptions: StepOptions = {
    maxStep: 10,
    resetStepCountAfterUserMessage: true,
    unansweredToolBehaviour: "answer",
    skipToolString: "Info: this too execution has been canceled. Do not assume it has been processed and inform the user that you are aware of it."
}

/**
 * Options for configuring the agent context.
 */
interface AgentContexOptions {
    /** Optional settings for each step in the agent's process. */
    stepOptions?: StepOptions,
    /** The name assigned to the agent. */
    name: string,
    /** Whether to use the developer role for the agent (optional). */
    useDeveloperRole?: boolean,
    /** Instructions or guidelines for the agent's behavior. */
    instructions: string,
    /** Optional array of tools available to the agent. */
    tools?: Tool<any>[],
    /** Optional initial conversation history for the agent. */
    initialConversation?: OpenAI.ChatCompletionMessageParam[],
    /** Model-specific settings excluding messages and tools. */
    modelSettings: Prettify<Omit<ChatCompletionCreateParamsBase, "messages" | "tools">>,
} //TODO: better comment for stepOptions with explaination for each fields

type SetOptionsParams = Omit<AgentContexOptions, "name">;

export type CreateAgentOptions<TStore extends StoreLike<any> = {}> = {
    store?: Store<TStore>
} & Prettify<AgentContexOptions>;

/**
 * Context of the agent which triggered the event or tool.
 */
export type AgentContext<TStore extends StoreLike<any> = {}, TGlobalStore extends StoreLike<any> = {}> = {
    /** The current state of the agent. */
    getState: () => AgentState,
    /** The configuration options for the agent context. */
    options: AgentContexOptions,
    /** Function to retrieve the agent's local store. */
    getStore: <TS extends StoreLike<any> = TStore>() => Store<TS> | undefined,
    /** Function to retrieve the global store shared across agents of the same Fragola instance. */
    getGlobalStore: <TGS extends StoreLike<any> = TGlobalStore>() => Store<TGS> | undefined,
    /**
     * Sets the current instructions for the agent.
     * @param instructions - The new instructions as a string.
     */
    setInstructions: (instructions: string) => void,
    /**
     * Updates the agent's options.
     * **note**: the `name` property is ommited
     * @param options - The new options to set, as a SetOptionsParams object.
     */
    setOptions: (options: SetOptionsParams) => void,
    stop: () => Promise<void>,
}

type StepBy = Partial<{
    /** To execute only up to N steps even if `maxStep` is not hit*/
    by: number,
}>;

type StepParams = StepBy & StepOptions;

export type UserMessageQuery = Prettify<Omit<OpenAI.Chat.ChatCompletionUserMessageParam, "role">> & { step?: StepParams };

/**
 * Maps an event ID to its corresponding callback type based on the event category.
 *
 * - For default event IDs (`AgentDefaultEventId`), returns the callback type from `eventDefaultCallbackMap`.
 * - For other event IDs, resolves to `never`.
 *
 * @template TEventId - The type of the event ID.
 * @template TGlobalStore - The type of the global store.
 * @template TStore - The type of the local store.
 */
type eventIdToCallback<TEventId extends AgentEventId, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> =
    TEventId extends AgentDefaultEventId ? eventDefaultCallbackMap<TGlobalStore, TStore>[TEventId] :
    TEventId extends AgentAfterEventId ? eventAfterCallbackMap<TGlobalStore, TStore>[TEventId] :
    never

type registeredEvent<TEventId extends AgentEventId, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
    id: string,
    callback: eventIdToCallback<TEventId, TGlobalStore, TStore>
}

type ConversationUpdateParams = {
    reason: conversationUpdateReason
}

type ApplyAfterConversationUpdateParams = ConversationUpdateParams;

type applyEventParams<K extends AgentEventId> =
    K extends "after:conversationUpdate" ? ApplyAfterConversationUpdateParams :
    K extends "conversationUpdate" ? ConversationUpdateParams :
    never;

export class Agent<TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> {
    public static defaultAgentState: AgentState = {
        conversation: [],
        stepCount: 0,
        status: "idle"
    }

    private openai: OpenAI;
    private paramsTools: ChatCompletionCreateParamsBase["tools"] = [];
    private registeredEvents: Map<AgentEventId, registeredEvent<AgentEventId, TGlobalStore, TStore>[]> = new Map();
    // Tmp values for applyEvents method
    private conversationTmp: AgentState["conversation"] | undefined = undefined;
    private abortController: AbortController | undefined = undefined;
    private stopRequested: boolean = false;

    constructor(private opts: CreateAgentOptions<TStore>, private globalStore: Store<TGlobalStore> | undefined = undefined, openai: OpenAI, private state: AgentState = Agent.defaultAgentState) {
        this.openai = openai;
        this.toolsToModelSettingsTools();
        if (opts.initialConversation != undefined)
            this.state.conversation = structuredClone(opts.initialConversation);
        if (!opts.stepOptions)
            this.opts["stepOptions"] = defaultStepOptions;
        else {
            this.opts["stepOptions"] = {
                ...defaultStepOptions,
                ...opts.stepOptions
            }
            this.validateStepOptions(this.opts.stepOptions);
        }
    }
    getState() { return this.state };

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

    private async appendMessages(messages: OpenAI.ChatCompletionMessageParam[], replaceLast: boolean = false, reason: conversationUpdateReason) {
        await this.updateConversation((prev) => {
            if (replaceLast)
                return [...prev.slice(0, -1), ...messages];
            return [...prev, ...messages]
        }, reason);
    }

    private async setIdle() { await this.updateState(prev => ({ ...prev, status: "idle" })) }
    private async setGenerating() { await this.updateState(prev => ({ ...prev, status: "generating" })) }
    private async setWaiting() { await this.updateState(prev => ({ ...prev, status: "waiting" })) }


    private async updateState(callback: (prev: typeof this.state) => typeof this.state) {
        this.state = callback(this.state);
        await this.applyEvents("after:stateUpdate", null);
    }

    private async updateConversation(callback: (prev: AgentState["conversation"]) => AgentState["conversation"], reason: conversationUpdateReason) {
        this.conversationTmp = callback(this.state.conversation);
        const newConversation = await this.applyEvents("conversationUpdate", { reason }) || this.conversationTmp;
        await this.updateState((prev) => ({ ...prev, conversation: newConversation }));
        await this.applyEvents("after:conversationUpdate", { reason });
    }

    private stepOptions() { return this.opts.stepOptions as Required<StepOptions> }

   private validateStepOptions(stepOptions: StepOptions | undefined) {
        if (!stepOptions)
            return;
        const { maxStep } = stepOptions;
        if (maxStep != undefined) {
            if (maxStep <= 0)
                throw new BadUsage(`field 'maxStep' of 'StepOptions' cannot be less than or equal to 0. Received '${maxStep}'`)
        }
    }

    async step(stepParams?: StepParams) {
        let overrideStepOptions: StepOptions | undefined = undefined;
        if (stepParams) {
            const { by, ...rest } = stepParams;
            if (by != undefined && by <= 0)
                throw new BadUsage(`field 'by' of 'stepParams' cannot be less than or equal to 0. Received '${by}'`);
            if (!rest || Object.keys(rest).length != 0)
                overrideStepOptions = rest;
        }
        if (overrideStepOptions)
            this.validateStepOptions(overrideStepOptions);
        const stepOptions: Required<StepOptions> = overrideStepOptions ? {...defaultStepOptions, ...overrideStepOptions} as Required<StepOptions> : this.stepOptions();
        if (this.state.conversation.length != 0)
            await this.recursiveAgent(stepOptions, () => {
                if (stepParams?.by != undefined)
                    return this.state.stepCount == (this.state.stepCount + stepParams.by);
                return false;
            }).finally(() => {
                this.abortController = undefined;
                this.stopRequested = false;
            });
        return this.state;
    }

    resetStepCount() {
        this.state.stepCount = 0;
    }

    /**
     * Stops the current agent execution.
     * This will abort any ongoing API calls and prevent further tool execution.
     */
    async stop() {
        this.stopRequested = true;
        if (this.abortController) {
            this.abortController.abort();
        }
    }

    private lastAiMessage(conversation: OpenAI.ChatCompletionMessageParam[]): OpenAI.ChatCompletionAssistantMessageParam | undefined {
        for (let i = conversation.length - 1; i >= 0; i--) {
            const msg = conversation[i];
            if (msg.role === "assistant") {
                return msg;
            }
        }
        return undefined;
    }

    createAgentContext<TGS extends StoreLike<any> = TGlobalStore, TS extends StoreLike<any> = TStore>(): AgentContext<TS, TGS> {
        return {
            getState: () => this.state,
            options: this.opts,
            getStore: <TS>() => this.opts.store as Store<TS> | undefined,
            getGlobalStore: <TGS>() => this.globalStore as Store<TGS> | undefined,
            setInstructions: (instructions) => {
                this.opts["instructions"] = instructions;
            },
            stop: async () => await this.stop(),
            setOptions: (options) => {
                this.opts = { ...options, name: this.opts.name, store: this.opts.store }
            }
        }
    }

    private setStepCount(value: number) {
        this.updateState((prev) => {
            return {
                ...prev,
                stepCount: value
            }
        });
    }

    private async recursiveAgent(stepOptions: Required<StepOptions>, stop: () => boolean, iter = 0): Promise<void> {
        // Check if stop was requested
        if (this.stopRequested) {
            return;
        }

        if (stepOptions.resetStepCountAfterUserMessage) {
            if (this.state.conversation.at(-1)?.role == "user")
                this.setStepCount(0);
        }
        if (this.state.stepCount == stepOptions.maxStep)
            throw new MaxStepHitError(``);

        this.abortController = new AbortController();

        const lastMessage: OpenAI.ChatCompletionMessageParam | undefined = this.state.conversation.at(-1);
        let aiMessage: OpenAI.ChatCompletionAssistantMessageParam;
        let lastAiMessage: OpenAI.ChatCompletionAssistantMessageParam | undefined = undefined;
        let toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];

        const shouldGenerate: boolean = (() => {
            if (lastMessage?.role == "user")
                return true;
            if (lastMessage?.role == "tool") {
                lastAiMessage = this.lastAiMessage(this.state.conversation);
                if (!lastAiMessage)
                    throw new FragolaError("Invalid conversation, found 'tool' role without previous 'assistant' role.");
                if (!lastAiMessage.tool_calls)
                    throw new FragolaError("Invalid conversation, found 'tool' role but 'tool_calls' is empty in previous 'assistant' role.");

                // Some tool calls may be already answered, we filter them out
                toolCalls = lastAiMessage.tool_calls.filter(toolCall => {
                    return !this.state.conversation.some(message => message.role == "tool" && message.tool_call_id == toolCall.id)
                });
                // Generation can happen only if all tool_calls have been answered, if not the case, tool calls will be answered and the generation can happen in the next recursive turn
                return toolCalls.length == 0;
            }
            return false;
        })();

        if (shouldGenerate) {
            const events = this.registeredEvents.get("modelInvocation");
            const defaultProcessChunck: CallAPIProcessChuck = (chunck) => chunck;
            const defaultModelSettings: CreateAgentOptions<any>["modelSettings"] = this.opts.modelSettings;

            const callAPI: CallAPI = async (processChunck, modelSettings, clientOpts) => {
                const _processChunck = processChunck || defaultProcessChunck;
                const _modelSettings = modelSettings || defaultModelSettings;
                const openai = clientOpts ? new OpenAI(clientOpts) : this.openai;

                let requestBody: ChatCompletionCreateParamsBase = {
                    ..._modelSettings,
                    messages: [{ role: "system", content: this.opts.instructions }, ...this.state.conversation]
                };
                if (this.paramsTools?.length)
                    requestBody["tools"] = this.paramsTools;

                this.setGenerating();
                const response = await openai.chat.completions.create(requestBody, { signal: this.abortController!.signal });

                // Handle streaming vs non-streaming
                if (Symbol.asyncIterator in response) {
                    let partialMessage: Partial<OpenAI.Chat.ChatCompletionMessageParam> = {};
                    let replaceLast = false;

                    for await (const chunck of response) {
                        if (_processChunck.constructor.name == "AsyncFunction") {
                            const _chunck = await _processChunck(chunck, partialMessage as typeof aiMessage);
                            partialMessage = streamChunkToMessage(_chunck, partialMessage);
                        } else {
                            const _chunck = _processChunck(chunck, partialMessage as typeof aiMessage);
                            partialMessage = streamChunkToMessage(_chunck as OpenAI.ChatCompletionChunk, partialMessage);
                        }
                        const updateReason: conversationUpdateReason = !chunck.choices[0].finish_reason ? "partialAiMessage" : "AiMessage";
                        await this.appendMessages([partialMessage as OpenAI.Chat.ChatCompletionMessageParam], replaceLast, updateReason);
                        !replaceLast && (this.setStepCount(this.state.stepCount + 1));
                        replaceLast = true;
                    }
                    this.abortController = undefined;
                    aiMessage = partialMessage as typeof aiMessage;
                } else {
                    this.abortController = undefined;
                    aiMessage = response.choices[0].message as typeof aiMessage;
                    await this.appendMessages([aiMessage], false, "AiMessage");
                    this.setStepCount(this.state.stepCount + 1);
                }
                if (aiMessage.role == "assistant" && aiMessage.tool_calls && aiMessage.tool_calls.length)
                    toolCalls = aiMessage.tool_calls;
                return aiMessage;
            }
            if (events) {
                for (const event of events) {
                    let params: Parameters<ModelInvocationCallback<TGlobalStore, TStore>> = [callAPI, this.createAgentContext()];
                    const callback = event.callback as ModelInvocationCallback<TGlobalStore, TStore>;
                    if (callback.constructor.name == "AsyncFunction")
                        aiMessage = await callback(...params);
                    else
                        aiMessage = callback(...params) as ChatCompletionAssistantMessageParam;
                }
            } else
                await callAPI();
        } else if (lastMessage?.role == "assistant" && lastMessage.tool_calls && lastMessage.tool_calls.length) { // Last message is 'assistant' role without generation required, assign tool calls if any
            toolCalls = lastMessage.tool_calls;
        }

        // Handle tool calls if present
        if (toolCalls.length > 0) {
            await this.setWaiting();
            for (const toolCall of toolCalls) {
                // Check if stop was requested before processing each tool
                if (this.stopRequested) {
                    break;
                }

                // Find tool in options that matches the tool requested by last ai message
                const tool = this.opts.tools?.find(tool => tool.name == toolCall.function.name);
                if (!tool)
                    throw new FragolaError("Tool arguments parsing fail");

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
                const context = this.createAgentContext();
                const content = isAsync
                    ? await handler(paramsParsed?.data, context)
                    : handler(paramsParsed?.data, context);

                // add tool message to conversation
                const contentString: string = (() => {
                    switch (typeof content) {
                        case "string":
                            return content;
                        case "number":
                        case "boolean":
                        case "bigint":
                            return String(content);
                        default:
                            return JSON.stringify(content);
                    }
                })();
                const message: OpenAI.ChatCompletionMessageParam = {
                    role: "tool",
                    content: contentString,
                    tool_call_id: toolCall.id
                }
                await this.updateConversation((prev) => [...prev, message], "toolCall");
            }
            await this.setIdle();
            if (!stop())
                return await this.recursiveAgent(stepOptions, stop, iter + 1);
        }
        await this.setIdle();
    }

    async userMessage(query: UserMessageQuery): Promise<AgentState> {
        const { step, ...message } = query;
        await this.updateConversation((prev) => [...prev, { role: "user", ...message }], "userMessage");
        return await this.step(query.step);
    }

    private async applyEvents<TEventId extends AgentEventId>(eventId: TEventId, _params: applyEventParams<TEventId> | null): Promise<ReturnType<eventIdToCallback<TEventId, TGlobalStore, TStore>>> {
        const events = this.registeredEvents.get(eventId);
        if (!events)
            return undefined as ReturnType<eventIdToCallback<TEventId, TGlobalStore, TStore>>;
        for (let i = 0; i < events.length; i++) {
            const callback = events[i].callback;
            const defaultParams: Parameters<EventDefaultCallback<TGlobalStore, TStore>> = [this.createAgentContext()];
            switch (eventId) {
                case "after:stateUpdate": {
                    let params: Parameters<EventDefaultCallback<TGlobalStore, TStore>> = defaultParams;
                    if (isAsyncFunction(callback)) {
                        return await (callback as EventDefaultCallback<TGlobalStore, TStore>)(...params) as any;
                    } else {
                        return (callback as EventDefaultCallback<TGlobalStore, TStore>)(...params) as any;
                    }
                }
                case "after:conversationUpdate": {
                    type callbackType = AfterConversationUpdateCallback<TGlobalStore, TStore>;
                    let params: Parameters<callbackType> = [_params!.reason, ...defaultParams];
                    if (isAsyncFunction(callback)) {
                        return await (callback as callbackType)(...params) as any;
                    } else {
                        return (callback as callbackType)(...params) as any;
                    }
                }
                case "conversationUpdate": {
                    let params: Parameters<ConversationUpdateCallback<TGlobalStore, TStore>> = [this.conversationTmp || [], _params!.reason, ...defaultParams];
                    if (isAsyncFunction(callback)) {
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

    onAfterConversationUpdate(callback: AfterConversationUpdateCallback<TGlobalStore, TStore>) { return this.on("after:conversationUpdate", callback) }

    /**
     * Registers a callback for the "conversationUpdate" event.
     *
     * @param callback - Function that receives:
     *   - newConversation: The updated conversation messages.
     *     - getState: Returns the current agent state.
     *     - getStore: A function returning the local store instance or undefined.
     *     - getGlobalStore: A function returning the global store instance or undefined.
     * @returns the updated conversation messages (array or Promise).
     *
     * @example
     * agent.onConversationUpdate((newConversation) => {
     *   // Modify the last message before returning
     *   if (newConversation.length > 0) {
     *     newConversation[newConversation.length - 1].content += " (modified)";
     *   }
     *   return newConversation;
     * });
     */
    onConversationUpdate(callback: ConversationUpdateCallback<TGlobalStore, TStore>) { return this.on("conversationUpdate", callback) }

    onModelInvocation(callback: ModelInvocationCallback<TGlobalStore, TStore>) { return this.on("modelInvocation", callback) }

    onAfterStateUpdate(callback: AfterStateUpdateCallback<TGlobalStore, TStore>) { return this.on("after:stateUpdate", callback) }
}