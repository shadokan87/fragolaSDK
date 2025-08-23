import { Store } from "./store"
import type { ChatCompletionMessageParam, DefineMetaData, Tool } from "./fragola"
import type { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.js"
import { zodToJsonSchema } from "openai/_vendor/zod-to-json-schema/zodToJsonSchema.mjs"
import { streamChunkToMessage, isAsyncFunction } from "./utils"
import { BadUsage, FragolaError, MaxStepHitError } from "./exceptions"
import type z from "zod"
import type { maybePromise, Prettify, StoreLike } from "./types"
import OpenAI from "openai/index.js"
import { type AgentEventId, type AgentDefaultEventId, type EventDefaultCallback, type AgentAfterEventId, SKIP_EVENT } from "./event"
import type { CallAPI, CallAPIProcessChuck, callbackMap as eventDefaultCallbackMap, EventToolCall, EventUserMessage, EventModelInvocation, EventAiMessage } from "./eventDefault";
import { nanoid } from "nanoid"
import type { EventAfterConversationUpdate, AfterStateUpdateCallback, conversationUpdateReason, callbackMap as eventAfterCallbackMap } from "./eventAfter"
import type { ChatCompletionAssistantMessageParam } from "openai/resources"

export const createStore = <T extends StoreLike<any>>(data: StoreLike<T>) => new Store(data);

export type AgentState<TMetaData extends DefineMetaData<any> = {}> = {
    conversation: ChatCompletionMessageParam<TMetaData>[],
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
    /** Model-specific settings excluding messages and tools. */
    modelSettings: Prettify<Omit<ChatCompletionCreateParamsBase, "messages" | "tools">>,
} //TODO: better comment for stepOptions with explaination for each fields

type SetOptionsParams = Omit<AgentContexOptions, "name" | "initialConversation">;

export type CreateAgentOptions<TStore extends StoreLike<any> = {}> = {
    store?: Store<TStore>,
    /** Optional initial conversation history for the agent. */
    initialConversation?: OpenAI.ChatCompletionMessageParam[],
} & Prettify<AgentContexOptions>;

export type ResetParams = Prettify<Pick<Required<CreateAgentOptions>, "initialConversation">>;

export type AgentRaw<TMetaData extends DefineMetaData<any>, TGlobalStore, TStore> = (openai: OpenAI, context: AgentRawContext<TMetaData, TGlobalStore, TStore>) => maybePromise<AgentState<TMetaData>>;

const AGENT_FRIEND = Symbol('AgentAccess');

/**
 * Context of the agent which triggered the event or tool.
 */
export class AgentContext<TMetaData extends DefineMetaData<any> = {}, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> {
    constructor(
        private _state: AgentState<TMetaData>,
        private _options: AgentContexOptions,
        private _store: Store<TStore> | undefined,
        private _globalStore: Store<TGlobalStore> | undefined,
        private setInstructionsFn: (instructions: string) => void,
        private setOptionsFn: (options: SetOptionsParams) => void,
        private stopFn: () => Promise<void>
    ) { }

    [AGENT_FRIEND] = {
        setState: (newState: AgentState) => {
            this._state = newState;
        },
        setOptions: (newOptions: AgentContexOptions) => {
            this._options = newOptions;
        },
    };

    /** The current state of the agent. */
    get state() {
        return this._state;
    }

    /** The configuration options for the agent context. */
    get options() {
        return this._options;
    }

    /** Acess the agent's local store. */
    get store() {
        return this._store as Store<TStore> | undefined;
    }

    /** Returns the agent's local store casted as T. Recommanded when accessing the store from a tool */
    getStore<T extends StoreLike<any>>(): Store<T> | undefined { return this._store ? this._store as unknown as Store<T> : undefined }

    /** Access the global store shared across agents of the same Fragola instance. */
    get globalStore() {
        return this._globalStore as Store<TGlobalStore> | undefined;
    }

    /** Returns the global store casted as T. Recommanded when accessing the global store from a tool */
    getGlobalStore<T extends StoreLike<any>>(): Store<T> | undefined { return this._store ? this._store as unknown as Store<T> : undefined }

    /**
     * Sets the current instructions for the agent.
     * @param instructions - The new instructions as a string.
     */
    setInstructions(instructions: string) {
        this.setInstructionsFn(instructions);
    }

    /**
     * Updates the agent's options.
     * **note**: the `name` property is ommited
     * @param options - The new options to set, as a SetOptionsParams object.
     */
    setOptions(options: SetOptionsParams) {
        this.setOptionsFn(options);
    }

    async stop() {
        return await this.stopFn();
    }
}

interface agentRawMethods {
    setIdle: () => Promise<void>,
    setWaiting: () => Promise<void>,
    setGenerating: () => Promise<void>,
    setState: (state: AgentState<any>) => Promise<void>
}

export class AgentRawContext<TMetaData extends DefineMetaData<any> = {}, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> extends AgentContext<TMetaData, TGlobalStore, TStore> {
    constructor(
        _state: AgentState<TMetaData>,
        _options: AgentContexOptions,
        _store: Store<TStore> | undefined,
        _globalStore: Store<TGlobalStore> | undefined,
        setInstructionsFn: (instructions: string) => void,
        setOptionsFn: (options: SetOptionsParams) => void,
        stopFn: () => Promise<void>,
        private rawMethods: agentRawMethods
    ) {
        super(_state, _options, _store, _globalStore, setInstructionsFn, setOptionsFn, stopFn);
    }

    get raw() {
        return this.rawMethods;
    }
}

type StepBy = Partial<{
    /** To execute only up to N steps even if `maxStep` is not hit*/
    by: number,
}>;

export type StepParams = StepBy & StepOptions;

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
type eventIdToCallback<TEventId extends AgentEventId, TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> =
    TEventId extends AgentDefaultEventId ? eventDefaultCallbackMap<TMetaData, TGlobalStore, TStore>[TEventId] :
    TEventId extends AgentAfterEventId ? eventAfterCallbackMap<TMetaData, TGlobalStore, TStore>[TEventId] :
    never

type registeredEvent<TEventId extends AgentEventId, TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
    id: string,
    callback: eventIdToCallback<TEventId, TMetaData, TGlobalStore, TStore>
}

type ConversationUpdateParams = {
    reason: conversationUpdateReason
}

type ApplyAfterConversationUpdateParams = ConversationUpdateParams;

type applyEventParams<K extends AgentEventId> =
    K extends "after:conversationUpdate" ? ApplyAfterConversationUpdateParams :
    K extends "conversationUpdate" ? ConversationUpdateParams :
    never;

export class Agent<TMetaData extends DefineMetaData<any> = {}, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> {
    public static defaultAgentState: AgentState = {
        conversation: [],
        stepCount: 0,
        status: "idle"
    }

    private openai: OpenAI;
    private paramsTools: ChatCompletionCreateParamsBase["tools"] = [];
    private registeredEvents: Map<AgentEventId, registeredEvent<AgentEventId, TMetaData, TGlobalStore, TStore>[]> = new Map();
    private abortController: AbortController | undefined = undefined;
    private stopRequested: boolean = false;
    private context: AgentContext<TMetaData, TGlobalStore, TStore>;

    constructor(
        private opts: CreateAgentOptions<TStore>,
        private globalStore: Store<TGlobalStore> | undefined = undefined,
        openai: OpenAI,
        private state = Agent.defaultAgentState as AgentState<TMetaData>) {
        this.context = this.createAgentContext();
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

    //TODO: for future versions
    // async raw(callback: AgentRaw<TMetaData, TGlobalStore, TStore>) {
    //     const rawContext = new AgentRawContext(this.state,
    //         this.opts,
    //         this.opts.store as Store<TStore> | undefined,
    //         this.globalStore as Store<TGlobalStore> | undefined,
    //         (instructions) => {
    //             this.opts["instructions"] = instructions;
    //         },
    //         (options) => {
    //             this.opts = { ...options, name: this.opts.name, store: this.opts.store }
    //         },
    //         async () => await this.stop(), {
    //         setGenerating: this.setGenerating,
    //         setIdle: this.setIdle,
    //         setWaiting: this.setWaiting,
    //         setState: async (state: AgentState<any>) => {
    //             this.updateState(() => state)
    //         }
    //     });

    //     if (isAsyncFunction(callback)) {
    //         const newState = await callback(this.openai, rawContext);
    //         this.updateState(() => newState);
    //     } else {
    //         const newState = callback(this.openai, rawContext) as Awaited<ReturnType<typeof callback>>;
    //         this.updateState(() => newState);
    //     }
    //     return this.state
    // }

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
        this.context[AGENT_FRIEND].setState(this.state);
        await this.applyEvents("after:stateUpdate", null);
    }

    private async updateConversation(callback: (prev: AgentState<TMetaData>["conversation"]) => AgentState<TMetaData>["conversation"], reason: conversationUpdateReason) {
        await this.updateState((prev) => ({ ...prev, conversation: callback(this.state.conversation) }));
        await this.applyEvents("after:conversationUpdate", { reason });
    }

    /**
     * Updates the agent's options.
     * **Note**: Can only be called when agent status is "idle". 
     * The `name` and `initialConversation` properties are omitted.
     * 
     * @param options - The new options to set, as a SetOptionsParams object.
     * @throws {BadUsage} When called while agent is not idle (generating or waiting).
     */
    setOptions(options: SetOptionsParams) {
        if (this.state.status !== "idle") {
            throw new BadUsage(
                `Cannot change options while agent is '${this.state.status}'. ` +
                `Options can only be changed when agent status is 'idle'.`
            );
        }
        this.opts = { ...this.opts, ...options };
        this.context[AGENT_FRIEND].setOptions({ ...this.context.options, ...options });
    }

    get options() { return this.opts }

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
        const stepOptions: Required<StepOptions> = overrideStepOptions ? { ...defaultStepOptions, ...overrideStepOptions } as Required<StepOptions> : this.stepOptions();
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

    reset(params: ResetParams = { initialConversation: [] }) {
        if (this.state.status != "idle") {
            throw new BadUsage(
                `Cannot reset while agent is '${this.state.status}'. ` +
                `Agent can only be reset when agent status is 'idle'.`
            );
        }
        this.updateState(() => ({
            status: "idle",
            conversation: params.initialConversation,
            stepCount: 0
        }));
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

    private createAgentContext<TM extends DefineMetaData<any> = TMetaData, TGS extends StoreLike<any> = TGlobalStore, TS extends StoreLike<any> = TStore>(): AgentContext<TM, TGS, TS> {
        return new AgentContext<TM, TGS, TS>(
            this.state,
            this.opts,
            this.opts.store as Store<TS> | undefined,
            this.globalStore as Store<TGS> | undefined,
            (instructions) => {
                this.opts["instructions"] = instructions;
            },
            (options) => {
                this.opts = { ...options, name: this.opts.name, store: this.opts.store }
            },
            async () => await this.stop()
        );
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

                const role: ChatCompletionCreateParamsBase["messages"][0]["role"] = this.opts.useDeveloperRole ? "developer" : "system";
                let requestBody: ChatCompletionCreateParamsBase = {
                    ..._modelSettings,
                    messages: [{ role, content: this.opts.instructions }, ...this.state.conversation]
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
                    let params: Parameters<EventModelInvocation<TMetaData, TGlobalStore, TStore>> = [callAPI, this.context];
                    const callback = event.callback as EventModelInvocation<TMetaData, TGlobalStore, TStore>;
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
                const toolCallEvents = this.registeredEvents.get("toolCall");
                const content = (async () => {
                    eventProcessing: {
                        if (!toolCallEvents) {
                            if (tool.handler == "dynamic")
                                throw new BadUsage(`Tools with dynamic handlers must have at least 1 'toolCall' event that produces a result.`);
                            break eventProcessing; // Jump to default behavior
                        }
                        for (let i = 0; i < toolCallEvents.length; i++) {
                            const _event = toolCallEvents[i];
                            const result = isAsyncFunction(_event.callback) ? await _event.callback(paramsParsed?.data, tool as any, this.context)
                                : _event.callback(paramsParsed?.data, tool as any, this.context);
                            if (typeof result == "object" && (result as any)[SKIP_EVENT] == true) {
                                continue;
                            }
                            return result;
                        }
                        if (tool.handler == "dynamic")
                            throw new BadUsage(`Tools with dynamic handlers must have at least 1 'toolCall' event that produces a result. (one or more events were found but returned 'skip')`);
                        // If we reach here, fall through to default behavior
                    }

                    // Default tool behavior (executed after breaking from eventProcessing)
                    return isAsyncFunction(tool.handler) ? await tool.handler(paramsParsed?.data, this.context as any) : tool.handler(paramsParsed?.data, this.context as any);
                })();
                // const isAsync = handler.constructor.name === "AsyncFunction";
                // const content = isAsync
                //     ? await handler(paramsParsed?.data, this.context)
                //     : handler(paramsParsed?.data, this.context);

                // add tool message to conversation
                const contentString: string = (() => {
                    switch (typeof content) {
                        case "string":
                            return content;
                        case "function":
                            return (content as Function).toString();
                        case "undefined":
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

    private async applyEvents<TEventId extends AgentEventId>(eventId: TEventId, _params: applyEventParams<TEventId> | null): Promise<ReturnType<eventIdToCallback<TEventId, TMetaData, TGlobalStore, TStore>>> {
        const events = this.registeredEvents.get(eventId);
        type EventDefaultType = EventDefaultCallback<TMetaData, TGlobalStore, TStore>;
        if (!events)
            return undefined as ReturnType<eventIdToCallback<TEventId, TMetaData, TGlobalStore, TStore>>;
        for (let i = 0; i < events.length; i++) {
            const callback = events[i].callback;
            const defaultParams: Parameters<EventDefaultType> = [this.createAgentContext()];
            switch (eventId) {
                case "after:stateUpdate": {
                    let params: Parameters<EventDefaultType> = defaultParams;
                    if (isAsyncFunction(callback)) {
                        return await (callback as EventDefaultType)(...params) as any;
                    } else {
                        return (callback as EventDefaultType)(...params) as any;
                    }
                }
                case "after:conversationUpdate": {
                    type callbackType = EventAfterConversationUpdate<TMetaData, TGlobalStore, TStore>;
                    let params: Parameters<callbackType> = [_params!.reason, ...defaultParams];
                    if (isAsyncFunction(callback)) {
                        return await (callback as callbackType)(...params) as any;
                    } else {
                        return (callback as callbackType)(...params) as any;
                    }
                }
                default: {
                    throw new FragolaError(`Internal error: event with name '${eventId}' is unknown`)
                }
            }
        }
        return undefined as ReturnType<eventIdToCallback<TEventId, TMetaData, TGlobalStore, TStore>>;
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
    on<TEventId extends AgentEventId>(eventId: TEventId, callback: eventIdToCallback<TEventId, TMetaData, TGlobalStore, TStore>
    ) {
        type EventTargetType = registeredEvent<TEventId, TMetaData, TGlobalStore, TStore>;
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

    onToolCall<TParams = Record<any, any>>(callback: EventToolCall<TParams, TMetaData, TGlobalStore, TStore>) { return this.on("toolCall", callback) }

    onAfterConversationUpdate(callback: EventAfterConversationUpdate<TMetaData, TGlobalStore, TStore>) { return this.on("after:conversationUpdate", callback) }

    onAiMessage(callback: EventAiMessage<TMetaData, TGlobalStore, TStore>) { return this.on("aiMessage", callback) }

    onUserMessage(callback: EventUserMessage<TMetaData, TGlobalStore, TStore>) { return this.on("userMessage", callback) }

    onModelInvocation(callback: EventModelInvocation<TMetaData, TGlobalStore, TStore>) { return this.on("modelInvocation", callback) }

    onAfterStateUpdate(callback: AfterStateUpdateCallback<TMetaData, TGlobalStore, TStore>) { return this.on("after:stateUpdate", callback) }
}