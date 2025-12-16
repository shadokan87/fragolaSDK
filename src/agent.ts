// TODO: dispose method
// TODO: logger method
import { createStore, Store } from "@src/store"
import { Fragola, stripUserMessageMeta, type ChatCompletionAssistantMessageParam, type ChatCompletionMessageParam, type ChatCompletionUserMessageParam, type DefineMetaData, type MessageMeta, type Tool } from "./fragola"
import type { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.js"
import { streamChunkToMessage, isAsyncFunction, isSkipEvent, skipEventFallback } from "./utils"
import { BadUsage, FragolaError, JsonModeError, MaxStepHitError } from "./exceptions"
import type z from "zod";
import { z as zod } from "zod";
import type { maybePromise, Prettify, StoreLike } from "./types"
import OpenAI from "openai/index.js"
import { type AgentEventId, type EventDefaultCallback } from "./event"
import type { CallAPI, CallAPIProcessChuck, EventToolCall, EventUserMessage, EventModelInvocation, EventAiMessage, EventStep } from "./eventDefault";
import { nanoid } from "nanoid"
import type { EventAfterMessagesUpdate, AfterStateUpdateCallback, messagesUpdateReason, EventAfterStep, EventAfterModelInvocation, EventAfterToolCall } from "./eventAfter"
import type { EventBeforeStep, EventBeforeModelInvocation, EventBeforeToolCall } from "./eventBefore"
import { type registeredEvent, type eventIdToCallback, EventMap } from "./extendedJS/events/EventMap"
import type { FragolaHook } from "@src/hook/index";
import { zodToJsonSchema } from "openai/_vendor/zod-to-json-schema/zodToJsonSchema.js"
import type { ResponseFormatJSONSchema } from "openai/resources"
import { AgentContext } from "@src/agentContext";
import { STOP } from "@src/agentContext"

export type AgentState<TMetaData extends DefineMetaData<any> = {}> = {
    messages: ChatCompletionMessageParam<TMetaData>[],
    stepCount: number,
    status: "idle" | "generating" | "waiting",
}

export type JsonOptions<T extends z.ZodTypeAny = z.ZodTypeAny> = {
    message: string;
    /** A Zod schema describing the expected JSON shape returned by the AI/tool */
    schema: T;
    /** prefer calling a tool instead of using the AI completion */
    preferToolCall?: boolean;
    /** optional model settings passthrough */
    modelSettings?: AgentOptions["modelSettings"];
};

/**
 * Options for controlling the agent's step execution behavior.
 *
 * @see {@link defaultStepOptions} for default values.
 */
export type StepOptions = Partial<{
    /** The maximum number of steps to execute in one call (default: 10). */
    maxStep: number,
    /** Wether or not to reset agent state `stepCount` after each user messages. `true` is recommanded for messagesal agents.*/
    resetStepCountAfterUserMessage: boolean,

    //TODO: unanswered tool behaviour fields
    // /** Determines how to handle unanswered tool calls: `answer` to process them, `skip` to ignore (default: "answer"). */
    // unansweredToolBehaviour: "answer" | "skip",
    // /** The string to use when skipping a tool call (default: "(generation has been canceled, you may ignore this tool output)"). */
    skipToolString: string,
    /** Will override the agent model settings. `response_format` will always be ovrride when using `json` method*/
    modelSettings?: ModelSettings,
    //@ts-nocheck
    /**
     * Execute the steps on a cloned agent using  so the original state is not changed.
     * When true the call runs on a {@link Agent.fork} (clone) and returns the clone's output.
     * Use for speculative execution, testing, or to extract structured output without
     * mutating the main agent.
     * @default false
     */
    fork: boolean,
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
    // unansweredToolBehaviour: "answer",
    // skipToolString: "Info: this too execution has been canceled. Do not assume it has been processed and inform the user that you are aware of it."
}

export type EventOptions = {
    priority?: number | "start" | "end"
}

export type PriorityLevel = "start" | "end";

const PRIORITY_LEVELS: Record<PriorityLevel, number> = {
    start: 1000,
    end: -1000,
};

const getPriorityValue = (opts?: EventOptions) => {
    if (!opts || opts.priority === undefined || opts.priority === null) return 0;
    const p = opts.priority as number | PriorityLevel;
    if (typeof p === "number") return p;
    return PRIORITY_LEVELS[p] ?? 0;
}

export type ModelSettings = Prettify<Omit<ChatCompletionCreateParamsBase, "messages" | "tools">>;

/**
 * Options for configuring the agent context.
 */
export interface AgentOptions {
    /** Optional settings for each step in the agent's process. */
    stepOptions?: StepOptions,
    /** The name assigned to the agent. */
    name: string,
    /** Whether to use the developer role for the agent (optional). */
    useDeveloperRole?: boolean,
    /** Instructions or guidelines for the agent's behavior. */
    instructions: string,
    /** Description of the agent, a detailed description is recommanded if used for orchestration or as a sub-agent */
    description: string,
    /** Optional array of tools available to the agent. */
    tools?: Tool<any>[],
    /** Model-specific settings excluding messages and tools. */
    modelSettings?: Omit<ModelSettings, "model"> & Partial<Pick<ModelSettings, "model">>
} //TODO: better comment for stepOptions with explaination for each fields

export type SetOptionsParams = Omit<AgentOptions, "name" | "messages" | "fork">;

export type CreateAgentOptions<TStore extends StoreLike<any> = {}> = {
    store?: Store<TStore>,
    /** Optional initial messages history for the agent. */
    messages?: OpenAI.ChatCompletionMessageParam[],
} & Prettify<AgentOptions>;

export type ResetParams = Prettify<Pick<Required<CreateAgentOptions>, "messages">>;

const AGENT_FRIEND = Symbol('AgentAccess');

// type AppendMessagesFn = (messages: OpenAI.ChatCompletionMessageParam[], replaceLast?: boolean, reason?: messagesUpdateReason) => Promise<void>;
// type UpdateMessagesFn = (callback: (prev: AgentState<any>["messages"]) => AgentState<any>["messages"], reason: messagesUpdateReason) => Promise<void>;
// Use these types for your ContextRaw
export type ContextRaw<TMetaData extends DefineMetaData<any> = {}> = {
    appendMessages(messages: OpenAI.ChatCompletionMessageParam[], replaceLast: boolean | undefined, reason: messagesUpdateReason): Promise<void>,
    updateMessages(callback: (prev: AgentState<TMetaData>["messages"]) => AgentState<TMetaData>["messages"], reason: messagesUpdateReason): Promise<void>
}

type StepBy = Partial<{
    /** To execute only up to N steps even if `maxStep` is not hit*/
    by: number,
}>;

export type StepParams = StepBy & StepOptions;

export type UserMessageQuery<TMetaData extends DefineMetaData<any> = {}> = Prettify<Omit<OpenAI.Chat.ChatCompletionUserMessageParam, "role">> & { step?: StepParams, meta?: MessageMeta<TMetaData, "user">};

export type JsonQuery<S extends z.ZodTypeAny = z.ZodTypeAny> = Prettify<UserMessageQuery & {
    /** Set to true to use tool calling to extract json instead of classic 'response_format' */
    preferToolCalling?: boolean
    /** Zod schema describing the expected JSON shape for the response */
    schema: S,
    /** If set to true, `userMessage` events will not be applied for this query */
    ignoreUserMessageEvents?: boolean,
} & Omit<ResponseFormatJSONSchema.JSONSchema, "schema">>;

export type JsonResult<S extends z.ZodTypeAny = z.ZodTypeAny, TMetaData extends DefineMetaData<any> = {}> = {
    state: AgentState<TMetaData>
} & z.SafeParseReturnType<unknown, z.infer<S>>;

type MessagesUpdateParams = {
    reason: messagesUpdateReason
}

type ApplyAfterMessagesUpdateParams = MessagesUpdateParams;

type applyEventParams<K extends AgentEventId, TMetaData extends DefineMetaData<any>> =
    K extends "after:messagesUpdate" ? ApplyAfterMessagesUpdateParams :
    K extends "messagesUpdate" ? MessagesUpdateParams :
    K extends "before:step" ? { options: Required<StepOptions> } :
    K extends "after:step" ? { options: Required<StepOptions> } :
    K extends "before:modelInvocation" ? {} :
    K extends "after:modelInvocation" ? { message: ChatCompletionAssistantMessageParam<TMetaData> } :
    K extends "before:toolCall" ? { params: any, tool: Tool<any> } :
    K extends "after:toolCall" ? { result: any, params: any, tool: Tool<any> } :
    never;

const FORK_FRIEND = Symbol("fork_friend");

export class Agent<TMetaData extends DefineMetaData<any> = {}, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> {
    public static defaultAgentState: AgentState = {
        messages: [],
        stepCount: 0,
        status: "idle"
    }

    private openai: OpenAI;
    private paramsTools: ChatCompletionCreateParamsBase["tools"] = [];
    private registeredEvents: EventMap<AgentEventId, registeredEvent<AgentEventId, TMetaData, TGlobalStore, TStore>[], TMetaData, TGlobalStore, TStore> = new EventMap(() => this.context)
    private abortController: AbortController | undefined = undefined;
    private stopRequested: boolean = false;
    private hooks: FragolaHook[] = [];
    /** serialized async initialization of hooks (ensures tools are ready before generation) */
    private hooksLoaded: Promise<void> = Promise.resolve();
    #state: AgentState<TMetaData>;
    #id: string;
    #forkOf: string | undefined = undefined;
    #instance: Fragola<TGlobalStore>;
    #namespaceStore: Map<string, Store<any>> = new Map();
    /** Scoped instructions map (scope -> instructions) */
    private instructionScopes: Map<string, string> = new Map();
    /** Cached merged instructions (default + scoped). Updated when scopes change. */
    private mergedInstructionsCache: string | undefined = undefined;

    constructor(
        private opts: CreateAgentOptions<TStore>,
        private globalStore: Store<TGlobalStore> | undefined = undefined,
        openai: OpenAI,
        forkOf: string | undefined = undefined,
        instance: Fragola,
        state = Agent.defaultAgentState as AgentState<TMetaData>,
    ) {

        this.#id = nanoid();
        this.#state = state;
        this.#forkOf = forkOf;
        this.#instance = instance as unknown as Fragola<TGlobalStore>;
        // this.context = this.createAgentContext();
        this.openai = openai;

        this.toolsToModelSettingsTools();
        if (opts.messages != undefined)
            this.#state.messages = structuredClone(opts.messages);
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

    private addStore(store: Store<any>): void {
        if (!store.namespace)
            throw new FragolaError(`Namespace must be defined in your store to use addStore.`);
        if (this.#namespaceStore.has(store.namespace))
            throw new FragolaError(`Store with namespace ${store.namespace} already added.`);
        this.#namespaceStore.set(store.namespace, store);
    }

    private removeStore(namespace: string): void {
        if (!this.#namespaceStore.has(namespace)) {
            console.warn(`Tried to remove store with namespace '${namespace}' that doesn't exist.`)
            return;
        }
        this.#namespaceStore.delete(namespace);
    }

    public context = (() => {
        const _this = this;
        return new class extends AgentContext<TMetaData, TGlobalStore, TStore> {
            get state() { return _this.state; }
            get options() { return _this.options; }
            get raw() {
                return {
                    appendMessages: (...args: Parameters<typeof _this.appendMessages>) => _this.appendMessages(...args),
                    updateMessages: (...args: Parameters<typeof _this.updateMessages>) => _this.updateMessages(...args)
                };
            }
            get store() { return _this.opts.store as Store<TStore>; }
            get instance() { return _this.#instance }
            getStore<T extends StoreLike<any>>(namespace?: string): Store<T> | undefined {
                let store = namespace ? _this.#namespaceStore.get(namespace) : _this.options.store;
                if (store)
                    return store as unknown as Store<T>;
                return undefined;
            }
            addStore(store: Store<any>): void {
                _this.addStore(store);
            }
            removeStore(namespace: string): void {
                _this.removeStore(namespace);
            }
            setInstructions(instructions: string, scope?: string): void {
                // If a scope is provided, store scoped instructions, otherwise update the default instructions
                if (scope) {
                    _this.instructionScopes.set(scope, instructions);
                } else {
                    _this.opts.instructions = instructions;
                }
                // Refresh cached merged instructions
                _this.updateMergedInstructionsCache();
            }
            getInstructions(scope?: string): string | undefined {
                if (scope)
                    return _this.instructionScopes.get(scope);
                return _this.opts.instructions ?? undefined;
            }
            removeInstructions(scope: string): boolean {
                const existed = _this.instructionScopes.delete(scope);
                if (existed)
                    _this.updateMergedInstructionsCache();
                return existed;
            }
            setOptions(options: SetOptionsParams): void {
                _this.setOptions(options);
            }
            async stop(): Promise<{[STOP]: true}> {
                await _this.stop();
                return {
                    [STOP]: true
                }
            }
            stopSync(): {[STOP]: true} {
                _this.stopSync();
                return {
                    [STOP]: true
                }
            }
            updateTools(callback: (prev: Tool[]) => Tool[]): void {

                const updatedTools = callback(_this.opts.tools ?? []);
                _this.opts.tools = updatedTools;
                _this.toolsToModelSettingsTools();
            }
        }
    })();

    private setRegisteredEvents = (map: typeof this.registeredEvents) => {
        this.registeredEvents = map;
    }

    [FORK_FRIEND] = {
        setRegisteredEvents: this.setRegisteredEvents,
        getRegisteredEvents: () => this.registeredEvents
    }

    get id() {
        return this.#id
    }

    get state() { return this.#state };

    fork() {
        const clonedOpts = structuredClone(this.opts);
        if (this.opts.store) {
            delete clonedOpts.store;
            clonedOpts["store"] = createStore(this.opts.store.value);
        }

        const clonedState = structuredClone(this.#state);
        const forked = new Agent<TMetaData, TGlobalStore, TStore>(
            clonedOpts,
            this.globalStore,
            this.openai,
            this.#id,
            this.#instance as Fragola<any>,
            clonedState,
        );

        this.hooks.forEach(hook => forked.use(hook));
        const forkedRegisteredEvents = forked[FORK_FRIEND].getRegisteredEvents();

        if (this.registeredEvents.size !== 0) {
            // Build merged entries starting from any events already present on the forked agent
            const mergedEntries: [AgentEventId, registeredEvent<AgentEventId, TMetaData, TGlobalStore, TStore>[]][] = [];

            // Copy existing fork events (if any) to mergedEntries
            for (const [k, v] of forkedRegisteredEvents.entries()) {
                mergedEntries.push([k, v.map(e => ({ ...e }))]);
            }

            // Merge events from the original agent, but skip events whose id already exists in the fork
            for (const [k, v] of this.registeredEvents.entries()) {
                const existing = mergedEntries.find(([key]) => key === k);
                if (existing) {
                    const existingIds = new Set(existing[1].map(e => e.id));
                    const toAdd = v
                        .filter(ev => !existingIds.has(ev.id))
                        .map(ev => ({ ...ev }));
                    existing[1].push(...toAdd);
                } else {
                    mergedEntries.push([k, v.map(ev => ({ ...ev }))]);
                }
            }

            const cloneRegisteredEvents = new EventMap(() => forked.context, mergedEntries);
            forked[FORK_FRIEND].setRegisteredEvents(cloneRegisteredEvents);
        }
        return forked;
    }

    private toolsToModelSettingsTools() {
        const result: ChatCompletionCreateParamsBase["tools"] = [];
        this.opts.tools?.forEach(tool => {
            let parameters: any = undefined;

            if (tool.schema) {
                if (typeof tool.schema === 'string') {
                    // If schema is a string, parse it as JSON and use directly
                    try {
                        parameters = JSON.parse(tool.schema);
                    } catch {
                        // If parsing fails, assume it's already a valid JSON schema string format
                        throw new BadUsage(`Tool '${tool.name}' has an invalid JSON schema string. Must be valid JSON.`);
                    }
                } else {
                    // If schema is a Zod schema, convert to JSON schema
                    parameters = zodToJsonSchema(tool.schema);
                }
            }

            result.push({
                type: "function",
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters
                }
            })
        });
        this.paramsTools = result;
    }

    /** Recompute merged instructions and store in cache. */
    private updateMergedInstructionsCache() {
        this.mergedInstructionsCache = this.computeMergedInstructions();
    }

    /** Build merged instructions from default + scoped instructions. */
    private computeMergedInstructions(): string {
        const base = this.opts.instructions ?? "";
        const parts: string[] = [];
        if (base) parts.push(base);
        // deterministic order for merging: sort scope keys
        const scopes = Array.from(this.instructionScopes.keys()).sort();
        for (const s of scopes) {
            const v = this.instructionScopes.get(s);
            if (v && v.length) {
                // annotate with scope so it's easy to debug/strip if needed
                parts.push(v);
            }
        }
        return parts.join("\n");
    }

    /** Return cached merged instructions, computing them if necessary. */
    private getMergedInstructions(): string {
        if (this.mergedInstructionsCache === undefined) this.updateMergedInstructionsCache();
        return this.mergedInstructionsCache ?? "";
    }

    private async appendMessages(messages: OpenAI.ChatCompletionMessageParam[], replaceLast: boolean = false, reason: messagesUpdateReason) {
        await this.updateMessages((prev) => {
            if (replaceLast)
                return [...prev.slice(0, -1), ...messages];
            return [...prev, ...messages]
        }, reason);
    }

    private async setIdle() { await this.updateState(prev => ({ ...prev, status: "idle" })) }
    private async setGenerating() { await this.updateState(prev => ({ ...prev, status: "generating" })) }
    private async setWaiting() { await this.updateState(prev => ({ ...prev, status: "waiting" })) }


    private async updateState(callback: (prev: AgentState<TMetaData>) => AgentState<TMetaData>) {
        this.#state = callback(this.#state);
        await this.applyEvents("after:stateUpdate", null);
    }

    private async updateMessages(callback: (prev: AgentState<TMetaData>["messages"]) => AgentState<TMetaData>["messages"], reason: messagesUpdateReason) {
        await this.updateState((prev) => ({ ...prev, messages: callback(this.#state.messages) }));
        await this.applyEvents("after:messagesUpdate", { reason });
    }

    /**
     * Updates the agent's options.
     * **Note**: Can only be called when agent status is "idle". 
     * The `name` and `messages` properties are omitted.
     * 
     * @param options - The new options to set, as a SetOptionsParams object.
     * @throws {BadUsage} When called while agent is not idle (generating or waiting).
     */
    setOptions(options: SetOptionsParams) {
        if (this.#state.status !== "idle") {
            throw new BadUsage(
                `Cannot change options while agent is '${this.#state.status}'. ` +
                `Options can only be changed when agent status is 'idle'.`
            );
        }
        this.opts = { ...this.opts, ...options };
        this.toolsToModelSettingsTools();
        // If default instructions changed, refresh merged cache
        this.updateMergedInstructionsCache();
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
        await this.hooksLoaded;
        if (this.stopRequested) {
            this.abortController = undefined;
            this.stopRequested = false
        }
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
        let stepOptions: Required<StepOptions> = overrideStepOptions ? { ...defaultStepOptions, ...overrideStepOptions } as Required<StepOptions> : this.stepOptions();
        await this.applyEvents("before:step", { options: stepOptions });
        const stepEvents = this.registeredEvents.get("step");
        if (stepEvents) {
            for (const event of stepEvents) {
                const result = await (event.callback as EventStep<TMetaData, TGlobalStore, TStore>)(stepOptions, this.context);
                if (!isSkipEvent(result)) {
                    stepOptions = result as Required<StepOptions>;
                }
            }
        }
        if (this.#state.messages.length != 0)
            await this.recursiveAgent(stepOptions, () => {
                if (stepParams?.by != undefined)
                    return this.#state.stepCount == (this.#state.stepCount + stepParams.by);
                return false;
            }).finally(() => {
                this.abortController = undefined;
                this.stopRequested = false;
            });
        await this.applyEvents("after:step", { options: stepOptions });
        return this.#state;
    }

    resetStepCount() {
        this.#state.stepCount = 0;
    }

    reset(params: ResetParams = { messages: [] }) {
        if (this.#state.status != "idle") {
            throw new BadUsage(
                `Cannot reset while agent is '${this.#state.status}'. ` +
                `Agent can only be reset when agent status is 'idle'.`
            );
        }
        this.updateState(() => ({
            status: "idle",
            messages: params.messages,
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

    stopSync() {
        this.stopRequested = true;
        if (this.abortController) {
            this.abortController.abort();
        } 
    }

    private lastAiMessage(messages: OpenAI.ChatCompletionMessageParam[]): OpenAI.ChatCompletionAssistantMessageParam | undefined {
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.role === "assistant") {
                return msg;
            }
        }
        return undefined;
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
            if (this.#state.messages.at(-1)?.role == "user")
                this.setStepCount(0);
        }
        if (this.#state.stepCount == stepOptions.maxStep)
            throw new MaxStepHitError(``);

        this.abortController = new AbortController();

        const lastMessage: OpenAI.ChatCompletionMessageParam | undefined = this.#state.messages.at(-1);
        let aiMessage: OpenAI.ChatCompletionAssistantMessageParam;
        let lastAiMessage: OpenAI.ChatCompletionAssistantMessageParam | undefined = undefined;
        let toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];

        const shouldGenerate: boolean = (() => {
            if (lastMessage?.role == "user")
                return true;
            if (lastMessage?.role == "tool") {
                lastAiMessage = this.lastAiMessage(this.#state.messages);
                if (!lastAiMessage)
                    throw new FragolaError("Invalid messages, found 'tool' role without previous 'assistant' role.");
                if (!lastAiMessage.tool_calls)
                    throw new FragolaError("Invalid messages, found 'tool' role but 'tool_calls' is empty in previous 'assistant' role.");

                // Some tool calls may be already answered, we filter them out
                toolCalls = lastAiMessage.tool_calls.filter(toolCall => {
                    return !this.#state.messages.some(message => message.role == "tool" && message.tool_call_id == toolCall.id)
                });
                // Generation can happen only if all tool_calls have been answered, if not the case, tool calls will be answered and the generation can happen in the next recursive turn
                return toolCalls.length == 0;
            }
            return false;
        })();

        if (shouldGenerate) {
            const EmodelInvocation = this.registeredEvents.get("modelInvocation");
            const defaultProcessChunck: CallAPIProcessChuck = (chunck) => chunck;
            const defaultModelSettings: ModelSettings = stepOptions.modelSettings ?? this.modelSettings();
            let apiCalled: boolean = false;
            const callAPI: CallAPI = async (processChunck, modelSettings, clientOpts) => {
                apiCalled = true;
                const _processChunck = processChunck || defaultProcessChunck;
                let _modelSettings = modelSettings ? structuredClone(modelSettings) : structuredClone(defaultModelSettings)
                const openai = clientOpts ? new OpenAI(clientOpts) : this.openai;

                const instructionsRole: ChatCompletionCreateParamsBase["messages"][0]["role"] = this.opts.useDeveloperRole ? "developer" : "system";
                if (!_modelSettings["model"])
                    _modelSettings["model"] = this.modelSettings().model;
                const requestBody: ChatCompletionCreateParamsBase = {
                    ..._modelSettings as ChatCompletionCreateParamsBase,
                    messages: [{ role: instructionsRole, content: this.getMergedInstructions() }, ...this.#state.messages]
                };
                if (this.paramsTools?.length)
                    requestBody["tools"] = this.paramsTools;

                await this.applyEvents("before:modelInvocation", {});
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
                        const updateReason: messagesUpdateReason = !chunck.choices[0].finish_reason ? "partialAiMessage" : "AiMessage";
                        const partialMessageFinal = await this.registeredEvents.handleAiMessage(partialMessage as typeof aiMessage, updateReason == "partialAiMessage");
                        await this.appendMessages([partialMessageFinal as OpenAI.Chat.ChatCompletionMessageParam], replaceLast, updateReason);
                        if (!replaceLast) this.setStepCount(this.#state.stepCount + 1);
                        replaceLast = true;
                    }
                    this.abortController = undefined;
                    aiMessage = partialMessage as typeof aiMessage;
                } else {
                    this.abortController = undefined;
                    aiMessage = response.choices[0].message as typeof aiMessage;
                    await this.appendMessages([aiMessage], false, "AiMessage");
                    this.setStepCount(this.#state.stepCount + 1);
                }
                await this.applyEvents("after:modelInvocation", { message: aiMessage });
                if (aiMessage.role == "assistant" && aiMessage.tool_calls && aiMessage.tool_calls.length)
                    toolCalls = aiMessage.tool_calls;
                return aiMessage;
            }
            if (EmodelInvocation) {
                for (const event of EmodelInvocation) {
                    const params: Parameters<EventModelInvocation<TMetaData, TGlobalStore, TStore>> = [callAPI, this.context];
                    const callback = event.callback as EventModelInvocation<TMetaData, TGlobalStore, TStore>;
                    aiMessage = await skipEventFallback(await callback(...params), callAPI);
                    if (!apiCalled) {
                        await this.appendMessages([aiMessage], false, "AiMessage");
                        this.setStepCount(this.#state.stepCount + 1);
                    }
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

                if (toolCall.type != "function") {
                    continue;
                }

                // Find tool in options that matches the tool requested by last ai message
                const tool = this.opts.tools?.find(tool => tool.name == toolCall.function.name);
                if (!tool)
                    throw new FragolaError(`Tool ${toolCall.function.name} missing`);

                let paramsParsed: z.SafeParseReturnType<any, any> | undefined;
                let rawParams: any;

                if (tool.schema) {
                    if (typeof tool.schema === 'string') {
                        // If schema is a string, no validation - just parse the arguments
                        try {
                            rawParams = JSON.parse(toolCall.function.arguments);
                        } catch {
                            throw new FragolaError(`Tool '${tool.name}' arguments parsing failed`);
                        }
                    } else {
                        // If schema is a Zod schema, validate
                        paramsParsed = (tool.schema as z.Schema).safeParse(JSON.parse(toolCall.function.arguments));
                        if (!paramsParsed.success) {
                            //TODO: implement retry system for bad arguments
                            throw new FragolaError("Tool arguments parsing fail");
                        }
                    }
                }

                const toolCallEvents = this.registeredEvents.get("toolCall");
                await this.applyEvents("before:toolCall", { params: paramsParsed?.data ?? rawParams, tool: tool as any });
                const content = await (async () => {
                    eventProcessing: {
                        if (!toolCallEvents) {
                            if (tool.handler == "dynamic")
                                throw new BadUsage(`Tools with dynamic handlers must have at least 1 'toolCall' event that produces a result.`);
                            break eventProcessing;
                        }
                        for (let i = 0; i < toolCallEvents.length; i++) {
                            const _event = toolCallEvents[i];
                            const params = paramsParsed?.data ?? rawParams;
                            const callback = _event.callback as EventToolCall<any, TMetaData, TGlobalStore, TStore>;
                            const result = isAsyncFunction(callback) ? await callback(params, tool as any, this.context)
                                : callback(params, tool as any, this.context);
                            if (isSkipEvent(result)) {
                                continue;
                            }
                            return result;
                        }
                        if (tool.handler == "dynamic")
                            throw new BadUsage(`Tools with dynamic handlers must have at least 1 'toolCall' event that produces a result. (one or more events were found but returned 'skip')`);
                    }
                    // Default tool behavior (executed after breaking from eventProcessing)
                    const params = paramsParsed?.data ?? rawParams;
                    return isAsyncFunction(tool.handler) ? await tool.handler(params, this.context as any) : tool.handler(params, this.context as any);
                })();
                await this.applyEvents("after:toolCall", { result: content, params: paramsParsed?.data ?? rawParams, tool: tool as any });

                const contentToString = (content: unknown) => {
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
                }

                const message: OpenAI.ChatCompletionMessageParam = {
                    role: "tool",
                    content: contentToString(content),
                    tool_call_id: toolCall.id
                }
                await this.updateMessages((prev) => [...prev, message], "toolCall");
            }
            await this.setIdle();
            if (!stop())
                return await this.recursiveAgent(stepOptions, stop, iter + 1);
        }
        await this.setIdle();
    }

    private modelSettings(): ModelSettings {
        if (!this.options.modelSettings) {
            return {
                model: this.#instance.options.model,
            }
        }
        return { ...this.options.modelSettings, model: this.options.modelSettings.model ?? this.#instance.options.model }
    }

    async json<S extends z.ZodTypeAny = z.ZodTypeAny>(query: JsonQuery<S>): Promise<JsonResult<S, TMetaData>> {
        const { step, preferToolCalling, name, schema, strict, description, ignoreUserMessageEvents, ...message } = query;
        let _step = { ...step };
        void step;
        let _message: Omit<ChatCompletionUserMessageParam, "role">;
        if (!this.registeredEvents.handleUserMessage || ignoreUserMessageEvents)
            _message = message;
        else
            _message = await this.registeredEvents.handleUserMessage(message);
        await this.updateMessages((prev) => [...prev, stripUserMessageMeta({ role: "user", ..._message })], "userMessage");
        if (preferToolCalling) {

        } else {
            if (!_step?.modelSettings)
                _step["modelSettings"] = { ...this.modelSettings() }
            let jsonSchema = zodToJsonSchema(schema);
            _step.modelSettings.response_format = {
                type: "json_schema", json_schema: {
                    name,
                    description,
                    strict,
                    schema: jsonSchema,
                }
            }
        }
        const state = await this.step(_step);
        const lastAiMessage = this.lastAiMessage(state.messages);
        if (!lastAiMessage)
            throw new JsonModeError(`Expected last index of messages to be of role 'assistant'`);
        if (typeof lastAiMessage.content != 'string') {
            throw new JsonModeError(`Expected content of model response to be of type 'string', received '${typeof lastAiMessage.content}'`);
        }
        let jsonParsed: Object | undefined;
        try {
            jsonParsed = JSON.parse(lastAiMessage.content);
            const parsed = schema.safeParse(jsonParsed);
            return { ...parsed, state };
        } catch (e) {
            console.error(e);
            throw new JsonModeError(`JSON.parse() of model response failed: `);
        }
    }

    /**
     * Appends a user message to the messages and executes the agent for one or more steps.
     * Parameters:
     * @param query - The user message and optional per-call step controls.
     *                See {@link UserMessageQuery}
     *
     * @returns Promise<AgentState> - The updated agent state after processing the message and any model/tool steps.
     * @example
     * // 1) Minimal text message
     * await agent.userMessage({ content: "Say hello" });
     *
     * // 2) Multi-part content (text + image)
     * await agent.userMessage({
     *   content: [
     *     { type: "text", text: "What's in this image?" },
     *     { type: "image_url", image_url: { url: "https://example.com/cat.png" } }
     *   ]
     * });
     *
     * // 3) Limit the number of steps for this turn
     * await agent.userMessage({
     *   content: "Compute 2+2, then stop.",
     *   step: { by: 1 } // will stop execution after 1 turn (1 llm response maximum)
     * });
     *
     * // 4) Override model settings for this call (without changing agent defaults)
     * await agent.userMessage({
     *   content: "Answer concisely.",
     *   step: { modelSettings: { temperature: 0 } }
     * });
     */
    async userMessage(query: UserMessageQuery<TMetaData>): Promise<AgentState> {
        const { step, ...message } = query;
        void step;
        let _message: Omit<ChatCompletionUserMessageParam, "role">;
        let error: any | undefined = undefined;
        if (!this.registeredEvents.handleUserMessage)
            _message = message;
        else {
            try {
                _message = await this.registeredEvents.handleUserMessage(message);
            } catch (e) {
                error = e;
            }
        }
        if (error)
            throw error;
        await this.updateMessages((prev) => [...prev, stripUserMessageMeta({ role: "user", ..._message })], "userMessage");
        return await this.step(query.step);
    }

    /**
     * Will call every registered events via on* methods for `eventId` and pass the parameters `_params` to the callbacks
     * @param eventId - the id of the event
     * @param _params  - the parameters to pass to the callback
     * @returns 
     */
    private async applyEvents<TEventId extends AgentEventId>(eventId: TEventId, _params: applyEventParams<TEventId, TMetaData> | null): Promise<ReturnType<eventIdToCallback<TEventId, TMetaData, TGlobalStore, TStore>>> {
        const events = this.registeredEvents.get(eventId);
        type EventDefaultType = EventDefaultCallback<TMetaData, TGlobalStore, TStore>;
        if (!events)
            return undefined as ReturnType<eventIdToCallback<TEventId, TMetaData, TGlobalStore, TStore>>;
        for (let i = 0; i < events.length; i++) {
            const callback = events[i].callback;
            const defaultParams: Parameters<EventDefaultType> = [this.context];
            switch (eventId) {
                case "after:stateUpdate": {
                    const params: Parameters<EventDefaultType> = defaultParams;
                    if (isAsyncFunction(callback)) {
                        return await (callback as EventDefaultType)(...params) as any;
                    } else {
                        return (callback as EventDefaultType)(...params) as any;
                    }
                }
                case "after:messagesUpdate": {
                    type callbackType = EventAfterMessagesUpdate<TMetaData, TGlobalStore, TStore>;
                    const params: Parameters<callbackType> = [(_params as ApplyAfterMessagesUpdateParams).reason, ...defaultParams];
                    if (isAsyncFunction(callback)) {
                        return await (callback as callbackType)(...params) as any;
                    } else {
                        return (callback as callbackType)(...params) as any;
                    }
                }
                case "before:step": {
                    type callbackType = EventBeforeStep<TMetaData, TGlobalStore, TStore>;
                    const params: Parameters<callbackType> = [(_params as any).options, ...defaultParams];
                    if (isAsyncFunction(callback)) {
                        return await (callback as callbackType)(...params) as any;
                    } else {
                        return (callback as callbackType)(...params) as any;
                    }
                }
                case "after:step": {
                    type callbackType = EventAfterStep<TMetaData, TGlobalStore, TStore>;
                    const params: Parameters<callbackType> = [(_params as any).options, ...defaultParams];
                    if (isAsyncFunction(callback)) {
                        return await (callback as callbackType)(...params) as any;
                    } else {
                        return (callback as callbackType)(...params) as any;
                    }
                }
                case "before:modelInvocation": {
                    type callbackType = EventBeforeModelInvocation<TMetaData, TGlobalStore, TStore>;
                    const params: Parameters<callbackType> = defaultParams;
                    if (isAsyncFunction(callback)) {
                        return await (callback as callbackType)(...params) as any;
                    } else {
                        return (callback as callbackType)(...params) as any;
                    }
                }
                case "after:modelInvocation": {
                    type callbackType = EventAfterModelInvocation<TMetaData, TGlobalStore, TStore>;
                    const params: Parameters<callbackType> = [(_params as any).message, ...defaultParams];
                    if (isAsyncFunction(callback)) {
                        return await (callback as callbackType)(...params) as any;
                    } else {
                        return (callback as callbackType)(...params) as any;
                    }
                }
                case "before:toolCall": {
                    type callbackType = EventBeforeToolCall<any, TMetaData, TGlobalStore, TStore>;
                    const params: Parameters<callbackType> = [(_params as any).params, (_params as any).tool, ...defaultParams];
                    if (isAsyncFunction(callback)) {
                        return await (callback as callbackType)(...params) as any;
                    } else {
                        return (callback as callbackType)(...params) as any;
                    }
                }
                case "after:toolCall": {
                    type callbackType = EventAfterToolCall<any, TMetaData, TGlobalStore, TStore>;
                    const params: Parameters<callbackType> = [(_params as any).result, (_params as any).params, (_params as any).tool, ...defaultParams];
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
     * Register a handler for a given event id.
     * Returns an unsubscribe function that removes the registered handler.
     *
     * @example
     * // listen to userMessage events
     * const off = agent.on('userMessage', (message, context) => {
     *   // inspect or transform the message
     *   return { ...message, content: message.content.trim() };
     * });
     * // later
     * off();
     */
    on<TEventId extends AgentEventId>(eventId: TEventId, callback: eventIdToCallback<TEventId, TMetaData, TGlobalStore, TStore>
    , options?: EventOptions) {
        type EventTargetType = registeredEvent<TEventId, TMetaData, TGlobalStore, TStore>;
        const events = this.registeredEvents.get(eventId) || [] as EventTargetType[];
        const id = nanoid();
        events.push({
            id,
            callback: callback,
            options
        });
        // Sort by computed numeric priority (desc). If neither side has an explicit priority, preserve
        // insertion order (stable): lhs wins. Tie-break by id for deterministic ordering when priorities equal.
        events.sort((a, b) => {
            const aHas = a.options && a.options.priority !== undefined && a.options.priority !== null;
            const bHas = b.options && b.options.priority !== undefined && b.options.priority !== null;
            if (!aHas && !bHas) return 0; // preserve lhs when neither has priority
            const pa = getPriorityValue(a.options as EventOptions);
            const pb = getPriorityValue(b.options as EventOptions);
            if (pa === pb) return a.id.localeCompare(b.id);
            return pb - pa;
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
     * Register a tool call event handler.
     *
     * This handler is invoked when the agent needs to execute a tool. Handlers may return a value
     * that will be used as the tool result.
     *
     * @example
     * // simple tool handler that returns an object as result
     * agent.onToolCall(async (params, tool, context) => {
     *   // dynamic tools do not have a handler function, so we skip them
     *   if (params.handler == "dynamic") return skip();
     *   // do something with params and tool
     *   try {
     *      const result = await tool.handler(params);
     *      return { sucess: true, result }
     * } catch(e) {
     *      if (e extends Error)
     *      return { error: e.message }
     * }
     * });
     */
    onToolCall<TParams = Record<any, any>>(callback: EventToolCall<TParams, TMetaData, TGlobalStore, TStore>, options?: EventOptions) { return this.on("toolCall", callback, options) }

    /**
     * Register a handler that runs after the messages is updated.
     *
     * After-event handlers do not return a value. Use these to persist state, emit metrics or side-effects.
     *
     * @example
     * agent.onAfterMessagesUpdate((reason, context) => {
     *   // persist messages to a DB or telemetry
     *   console.log('messages updated because of', reason);
     *   context.getStore()?.value.lastSaved = Date.now();
     * });
     */
    onAfterMessagesUpdate(callback: EventAfterMessagesUpdate<TMetaData, TGlobalStore, TStore>, options?: EventOptions) { return this.on("after:messagesUpdate", callback, options) }

    /**
     * Register an AI message event handler.
     *
     * Called when an assistant message is generated or streaming. Handlers may return a modified
     * message which will replace the message in the messages.
     *
     * @example
     * agent.onAiMessage((message, isPartial, context) => {
     *   if (!isPartial && message.content.includes('debug')) {
     *     // modify final assistant message
     *      message.content += '(edited)';
     *   }
     *   return message;
     * });
     */
    onAiMessage(callback: EventAiMessage<TMetaData, TGlobalStore, TStore>, options?: EventOptions) { return this.on("aiMessage", callback, options) }

    /**
     * Register a user message event handler.
     *
     * Called when a user message is appended to the messages. Handlers may return a modified
     * user message which will be used instead of the original.
     *
     * @example
     * agent.onUserMessage((message, context) => {
     *   // enrich user message with metadata
     *   return { ...message, content: message.content.trim() };
     * });
     */
    onUserMessage(callback: EventUserMessage<TMetaData, TGlobalStore, TStore>, options?: EventOptions) { return this.on("userMessage", callback, options) }

    /**
     * Register a step event handler.
     *
     * Called when a step is executed. Handlers may return modified step options.
     *
     * @example
     * agent.onStep((options, context) => {
     *   // modify step options
     *   return { ...options, maxStep: 5 };
     * });
     */
    onStep(callback: EventStep<TMetaData, TGlobalStore, TStore>, options?: EventOptions) { return this.on("step", callback, options) }

    /**
     * Register a before step event handler.
     *
     * Called before a step is executed.
     *
     * @example
     * agent.onBeforeStep((options, context) => {
     *   console.log('Before step', options);
     * });
     */
    onBeforeStep(callback: EventBeforeStep<TMetaData, TGlobalStore, TStore>, options?: EventOptions) { return this.on("before:step", callback, options) }

    /**
     * Register an after step event handler.
     *
     * Called after a step is executed.
     *
     * @example
     * agent.onAfterStep((options, context) => {
     *   console.log('After step', options);
     * });
     */
    onAfterStep(callback: EventAfterStep<TMetaData, TGlobalStore, TStore>, options?: EventOptions) { return this.on("after:step", callback, options) }

    /**
     * Register a before model invocation event handler.
     *
     * Called before the model is invoked.
     *
     * @example
     * agent.onBeforeModelInvocation((context) => {
     *   console.log('Before model invocation');
     * });
     */
    onBeforeModelInvocation(callback: EventBeforeModelInvocation<TMetaData, TGlobalStore, TStore>, options?: EventOptions) { return this.on("before:modelInvocation", callback, options) }

    /**
     * Register an after model invocation event handler.
     *
     * Called after the model is invoked.
     *
     * @example
     * agent.onAfterModelInvocation((message, context) => {
     *   console.log('After model invocation', message);
     * });
     */
    onAfterModelInvocation(callback: EventAfterModelInvocation<TMetaData, TGlobalStore, TStore>, options?: EventOptions) { return this.on("after:modelInvocation", callback, options) }

    /**
     * Register a before tool call event handler.
     *
     * Called before a tool is executed.
     *
     * @example
     * agent.onBeforeToolCall((params, tool, context) => {
     *   console.log('Before tool call', tool.name, params);
     * });
     */
    onBeforeToolCall<TParams = Record<any, any>>(callback: EventBeforeToolCall<TParams, TMetaData, TGlobalStore, TStore>, options?: EventOptions) { return this.on("before:toolCall", callback, options) }

    /**
     * Register an after tool call event handler.
     *
     * Called after a tool is executed.
     *
     * @example
     * agent.onAfterToolCall((result, params, tool, context) => {
     *   console.log('After tool call', tool.name, result);
     * });
     */
    onAfterToolCall<TParams = Record<any, any>>(callback: EventAfterToolCall<TParams, TMetaData, TGlobalStore, TStore>, options?: EventOptions) { return this.on("after:toolCall", callback, options) }

    /**
     * Register a model invocation event handler.
     *
     * This handler wraps the model call. It receives a `callAPI` function to perform the request and
     * can return a modified assistant message. Handlers can also provide a `processChunk` function to
     * edit streaming chunks before they are applied to the partial assistant message.
     *
     * @example
     * // modify streaming chunks before they are applied
     * agent.onModelInvocation(async (callAPI, context) => {
     *   const processChunk: CallAPIProcessChuck = (chunk, partial) => {
     *     // e.g. redact sensitive tokens or append extra tokens
     *     chunck.choices[0].delta.content = '(modified)';
     *     // perform modifications on `modified` here
     *     return chunck;
     *   };
     *   // pass the processor to callAPI; it returns the final assistant message
     *   const aiMsg = await callAPI(processChunk);
     *   // post-process the final assistant message if needed
     *   return { ...aiMsg, content: aiMsg.content + '\n\n(checked)' };
     * });
     */
    onModelInvocation(callback: EventModelInvocation<TMetaData, TGlobalStore, TStore>, options?: EventOptions) { return this.on("modelInvocation", callback, options) }

    /**
     * Register a handler that runs after the agent state is updated.
     *
     * After-state-update handlers do not return a value. Use these for side-effects such as metrics
     * or asynchronous persistence.
     *
     * @example
     * agent.onAfterStateUpdate((context) => {
     *   // e.g. emit metrics about step count
     *   console.log('stepCount', context.state.stepCount);
     * });
     */
    onAfterStateUpdate(callback: AfterStateUpdateCallback<TMetaData, TGlobalStore, TStore>, options?: EventOptions) { return this.on("after:stateUpdate", callback, options) };

    /**
     * Attach a hook to this agent.
     *
     * Hooks receive the agent instance and may register event handlers
     * or otherwise augment the agent's behavior.
     *
     * @param hook - A FragolaHook to attach to the agent
     * @returns The agent instance (chainable)
     *
     * @example
     * ```ts
     * import { fileSystemSave } from "@src/hookPreset";
     * const agent = fragola.agent({...}).use(fileSystemSave("./testHook"));
     * // agent is returned so additional configuration/calls can be chained
     * ```
     */
    use(hook: FragolaHook) {
        // Chain initialization so multiple hooks initialize in sequence.
        // Accepts both sync and async hooks.
        this.hooksLoaded = this.hooksLoaded
            .then(() => Promise.resolve(hook(this as AgentAny)))
            .then(() => {
                this.hooks.push(hook);
            })
            .catch((err) => {
                // don't break chain on error, but surface a warning
                console.error("Failed to initialize hook:", err);
            });
        return this;
    }
}

export type AgentAny = Agent<any, any, any>;