// TODO: dispose method
// TODO: logger method
import { createStore, Store } from "./store"
import { Fragola, stripMessagesMeta, type ChatCompletionAssistantMessageParam, type ChatCompletionMessageParam, type ChatCompletionUserMessageParam, type DefineMetaData, type MessageMeta, type OpenaiClientOptions, type Tool } from "./fragola"
import type { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.js"
import { streamChunkToMessage, isAsyncFunction, isSkipEvent, isStopEvent, isChunkPartial } from "./utils"
import { BadUsage, FragolaError, JsonModeError, MaxStepHitError } from "./exceptions"
import type z from "zod";
import type { Prettify, StoreLike } from "./types"
import OpenAI from "openai/index.js"
import { type AgentEventId } from "./event"
import type { EventToolCall, EventUserMessage, EventModelInvocation, EventAiMessage, ModelInvocationPayload } from "./eventDefault";
import { nanoid } from "nanoid"
import type { EventAfterStateUpdate, EventAfterStep, EventAfterModelInvocation, EventAfterToolCall } from "./eventAfter"
import type { EventBeforeStep, EventBeforeModelInvocation, EventBeforeToolCall, ModelInvocationConfig, ToolCallConfig } from "./eventBefore"
import { type registeredEvent, type eventIdToCallback, EventMap } from "./extendedJS/events/EventMap"
import type { FragolaHook, FragolaHookDispose } from "@src/hook/index";
import { zodToJsonSchema } from "openai/_vendor/zod-to-json-schema/zodToJsonSchema.js"
import type { ChatCompletionChunk, ResponseFormatJSONSchema } from "openai/resources"
import { AgentContext } from "@src/agentContext";
import { STOP } from "@src/agentContext"
import { messagesUtils } from "./stateUtils";
import {
    applyAiMessage,
    applyAfterStateUpdate,
    applyBeforeStep,
    applyAfterStep,
    applyBeforeModelInvocation,
    applyAfterModelInvocation,
    applyUserMessage,
    applyBeforeToolCall,
    applyAfterToolCall,
    applyModelInvocation,
    applyToolCall,
    type EventResult,
    type AccumulateCallback,
    type ApplyEventResult
} from "./applyEvent"

export type AgentState<TMetaData extends DefineMetaData<any> = {}> = {
    messages: ChatCompletionMessageParam<TMetaData>[],
    stepCount: number,
    status: "generating" | "idle" | "waiting"
}

/**
 * Options that control how a single execution step runs.
 */
export type StepOptions = {
    /** The maximum number of steps to execute in one call (default: 10). */
    maxStep?: number,
    /** Wether or not to reset agent state `stepCount` after each user messages. `true` is recommanded for conversational agents.*/
    resetStepCountAfterUserMessage?: boolean,
    /** Will override the agent model settings. `response_format` will always be ovrride when using `json` method*/
    modelSettings?: Omit<ModelSettings, "model"> & Partial<Pick<ModelSettings, "model">>,
    /** Will override Openai SDK client options */
    clientOptions?: OpenaiClientOptions
}

export const defaultStepOptions: StepOptions = {
    maxStep: 10,
    resetStepCountAfterUserMessage: true,
    // unansweredToolBehaviour: "answer",
    // skipToolString: "Info: this too execution has been canceled. Do not assume it has been processed and inform the user that you are aware of it."
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

export type ContextRaw<TMetaData extends DefineMetaData<any> = {}> = {
    /**
     * Updates the current message list using the previous state as input.
     *
     * Use this to append, replace, or remove messages by returning the next
     * complete message array.
     */
    updateMessages(callback: (prev: AgentState<TMetaData>["messages"]) => AgentState<TMetaData>["messages"]): Promise<void>
}

type StepBy = Partial<{
    /** To execute only up to N steps even if `maxStep` is not hit*/
    by: number,
}>;

export type StepParams = StepBy & StepOptions;

export type UserMessageQuery<TMetaData extends DefineMetaData<any> = {}> = Prettify<Omit<OpenAI.Chat.ChatCompletionUserMessageParam, "role">> & { step?: StepParams, meta?: MessageMeta<TMetaData, "user"> };

export type JsonQuery<S extends z.ZodTypeAny = z.ZodTypeAny> = Prettify<UserMessageQuery & {
    /** Set to true to use tool calling to extract json instead of classic 'response_format' */
    // preferToolCalling?: boolean //TODO: for next versions
    /** Zod schema describing the expected JSON shape for the response */
    schema: S,
    /** If set to true, `userMessage` events will not be applied for this query */
    ignoreUserMessageEvents?: boolean,
} & Omit<ResponseFormatJSONSchema.JSONSchema, "schema">>;

export type JsonResult<S extends z.ZodTypeAny = z.ZodTypeAny, TMetaData extends DefineMetaData<any> = {}> = {
    state: AgentState<TMetaData>
} & z.SafeParseReturnType<unknown, z.infer<S>>;


export type applyEventParams<K extends AgentEventId, TMetaData extends DefineMetaData<any>> =
    K extends "modelInvocation" ? ModelInvocationPayload<TMetaData> :
    K extends "aiMessage" ? { message: ChatCompletionAssistantMessageParam<TMetaData>, finish_reason: OpenAI.Chat.Completions.ChatCompletionChunk.Choice['finish_reason'], usage: OpenAI.Chat.Completions.ChatCompletionChunk['usage'] } :
    K extends "userMessage" ? { message: Omit<ChatCompletionUserMessageParam<TMetaData>, "role"> } :
    K extends "step" ? { options: Required<StepOptions>, lastMessageRole: OpenAI.ChatCompletionMessageParam["role"] | undefined, lastMessageIndex: number } :
    K extends "before:step" ? { options: StepOptions } :
    K extends "after:step" ? { options: Required<StepOptions>, newMessages: ChatCompletionMessageParam<TMetaData>[], stepsTaken: number } :
    K extends "before:modelInvocation" ? { config: ModelInvocationConfig<TMetaData> } :
    K extends "after:modelInvocation" ? { message: ChatCompletionAssistantMessageParam<TMetaData> } :
    K extends "toolCall" ? { result: any, params: any, tool: Tool<any> } :
    K extends "before:toolCall" ? { config: ToolCallConfig<any>, tool: Tool<any> } :
    K extends "after:toolCall" ? { result: any, params: any, tool: Tool<any> } :
    K extends "after:stateUpdate" ? null :
    never;

export type appliedEvent<K extends AgentEventId, TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> =
    K extends "modelInvocation" ? ApplyEventResult<EventModelInvocation<TMetaData, TGlobalStore, TStore>> :
    K extends "aiMessage" ? ApplyEventResult<EventAiMessage<TMetaData, TGlobalStore, TStore>> :
    K extends "userMessage" ? ApplyEventResult<EventUserMessage<TMetaData, TGlobalStore, TStore>> :
    K extends "step" ? never :
    K extends "before:step" ? ApplyEventResult<EventBeforeStep<TMetaData, TGlobalStore, TStore>> :
    K extends "after:step" ? ApplyEventResult<EventAfterStep<TMetaData, TGlobalStore, TStore>> :
    K extends "before:modelInvocation" ? ApplyEventResult<EventBeforeModelInvocation<TMetaData, TGlobalStore, TStore>> :
    K extends "after:modelInvocation" ? ApplyEventResult<EventAfterModelInvocation<TMetaData, TGlobalStore, TStore>> :
    K extends "toolCall" ? ApplyEventResult<EventToolCall<any, TMetaData, TGlobalStore, TStore>> :
    K extends "before:toolCall" ? ApplyEventResult<EventBeforeToolCall<any, TMetaData, TGlobalStore, TStore>> :
    K extends "after:toolCall" ? ApplyEventResult<EventAfterToolCall<any, TMetaData, TGlobalStore, TStore>> :
    K extends "after:stateUpdate" ? ApplyEventResult<EventAfterStateUpdate<TMetaData, TGlobalStore, TStore>> :
    never;

const FORK_FRIEND = Symbol("fork_friend");
const NOOP_HOOK_DISPOSE: FragolaHookDispose = () => { };

const formatIssuePath = (path: Array<string | number>) => path.length ? path.map(String).join(".") : "<root>";

const formatZodIssues = (issues: z.ZodIssue[]) => issues
    .map((issue) => `${formatIssuePath(issue.path)}: ${issue.message}`)
    .join("; ");

const formatUnknownError = (error: unknown) => error instanceof Error ? error.message : String(error);

export class Agent<TMetaData extends DefineMetaData<any> = {}, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> {
    public static defaultAgentState: AgentState = {
        messages: [],
        stepCount: 0,
        status: "idle"
    }

    private openai: OpenAI;
    private paramsTools: ChatCompletionCreateParamsBase["tools"] = [];
    private registeredEvents = new EventMap<AgentEventId, registeredEvent<AgentEventId, TMetaData, TGlobalStore, TStore>[], TMetaData, TGlobalStore, TStore>()
    private abortController: AbortController | undefined = undefined;
    private stopRequested: boolean = false;
    private hooks: Array<{ hook: FragolaHook, name?: string, sourceHookId: string }> = [];
    private hookDisposeMap: Map<string, FragolaHookDispose> = new Map();
    private pendingHookNames: Set<string> = new Set();
    private activeHookSourceId: string | undefined = undefined;
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
        // this.context = this.createAgentStore();
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

    /** Returns the parent agent id when this agent was created with fork(). */
    get forkOf() {
        return this.#forkOf;
    }

    private addStore(store: Store<any>): void {
        if (!store.namespace)
            throw new FragolaError(`Cannot add store because the provided store has no namespace. This agent stores extra stores by namespace, so unnamed stores cannot be retrieved later. Create it with createStore(value, "your-namespace").`);
        if (this.#namespaceStore.has(store.namespace))
            throw new FragolaError(`Cannot add store with namespace '${store.namespace}' because this agent already has a store registered under that namespace. Namespaces must be unique per agent. Remove the existing store first or register the new store under a different namespace.`);
        this.#namespaceStore.set(store.namespace, store);
    }

    private removeStore(namespace: string): void {
        if (!this.#namespaceStore.has(namespace)) {
            console.warn(`Tried to remove context with namespace '${namespace}' that doesn't exist.`)
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
                    updateMessages: (...args: Parameters<typeof _this.updateMessages>) => _this.updateMessages(...args)
                };
            }
            get store() { return _this.opts.store as Store<TStore>; }
            get messagesParser() { return messagesUtils<TMetaData>(() => _this.state.messages); }
            get instance() { return _this.#instance }
            getStore<T extends StoreLike<any>>(namespace?: string): Store<T> | undefined {
                let context = namespace ? _this.#namespaceStore.get(namespace) : _this.options.store;
                if (context)
                    return context as unknown as Store<T>;
                return undefined;
            }
            addStore(store: Store<any>): void {
                _this.addStore(store);
            }
            removeStore(namespace: string): void {
                _this.removeStore(namespace);
            }
            setInstructions(instructions: string, scope?: string): void {
                // If a scope is provided, context scoped instructions, otherwise update the default instructions
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
            async stop(): Promise<{ [STOP]: true }> {
                await _this.stop();
                return {
                    [STOP]: true
                }
            }
            stopSync(): { [STOP]: true } {
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

    /** Returns the unique id of this agent instance. */
    get id() {
        return this.#id
    }

    /** Returns the current in-memory state for this agent. */
    get state() { return this.#state };

    private cloneStoreValue<T extends StoreLike<any>>(store: Store<T>): Store<T> {
        return createStore(structuredClone(store.value), store.namespace);
    }

    private cloneOptionsForFork(): CreateAgentOptions<TStore> {
        const clonedOpts = { ...this.opts } as CreateAgentOptions<TStore>;

        if (this.opts.stepOptions)
            clonedOpts.stepOptions = structuredClone(this.opts.stepOptions);
        if (this.opts.modelSettings)
            clonedOpts.modelSettings = structuredClone(this.opts.modelSettings);
        if (this.opts.messages)
            clonedOpts.messages = structuredClone(this.opts.messages);
        if (this.opts.store)
            clonedOpts.store = this.cloneStoreValue(this.opts.store);
        if (this.opts.tools)
            clonedOpts.tools = this.opts.tools.map((tool) => ({ ...tool }));

        return clonedOpts;
    }

    /**
     * Creates a new agent from the current one.
     *
     * The fork gets a new id, copies the current options, state, hooks, and registered
     * events, and sets `forkOf` to this agent's id. The OpenAI client and global context
     * are shared. If this agent has a local context, the fork receives a new context
     * instance seeded with the same value.
     *
     * @returns A new agent initialized from the current agent.
     */
    fork() {
        const clonedOpts = this.cloneOptionsForFork();
        const clonedInitialMessages = clonedOpts.messages;
        delete clonedOpts.messages;

        const clonedState = structuredClone(this.#state);
        const forked = new Agent<TMetaData, TGlobalStore, TStore>(
            clonedOpts,
            this.globalStore,
            this.openai,
            this.#id, // Id for fork
            this.#instance as Fragola<any>,
            clonedState,
        );

        if (clonedInitialMessages)
            forked.opts.messages = clonedInitialMessages;

        forked.instructionScopes = new Map(this.instructionScopes);
        forked.updateMergedInstructionsCache();

        for (const [namespace, context] of this.#namespaceStore.entries()) {
            forked.#namespaceStore.set(namespace, this.cloneStoreValue(context));
        }

        this.hooks.forEach(({ hook, name }) => forked.use(hook, name));
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
                        .filter(ev => !ev.sourceHookId)
                        .filter(ev => !existingIds.has(ev.id))
                        .map(ev => ({ ...ev }));
                    existing[1].push(...toAdd);
                } else {
                    mergedEntries.push([k, v.filter(ev => !ev.sourceHookId).map(ev => ({ ...ev }))]);
                }
            }

            const cloneRegisteredEvents = new EventMap<AgentEventId, registeredEvent<AgentEventId, TMetaData, TGlobalStore, TStore>[], TMetaData, TGlobalStore, TStore>(mergedEntries as [AgentEventId, registeredEvent<AgentEventId, TMetaData, TGlobalStore, TStore>[]][]);
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
                        throw new BadUsage(`Cannot register tool '${tool.name}' because its schema string is not valid JSON. String schemas are parsed before they are sent to the model, and JSON.parse failed. Pass a valid JSON Schema string or use a Zod schema instead.`);
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

    /** Recompute merged instructions and context in cache. */
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

    private async appendMessages(messages: ChatCompletionMessageParam<TMetaData>[], replaceLast: boolean = false) {
        await this.updateMessages((prev) => {
            if (replaceLast)
                return [...prev.slice(0, -1), ...messages];
            return [...prev, ...messages]
        });
    }

    private async setIdle() { await this.updateState(prev => ({ ...prev, status: "idle" })) }
    private async setGenerating() { await this.updateState(prev => ({ ...prev, status: "generating" })) }
    private async setWaiting() { await this.updateState(prev => ({ ...prev, status: "waiting" })) }


    private async updateState(callback: (prev: AgentState<TMetaData>) => AgentState<TMetaData>) {
        this.#state = callback(this.#state);
        await this.applyEvents("after:stateUpdate", null);
    }

    private async updateMessages(callback: (prev: AgentState<TMetaData>["messages"]) => AgentState<TMetaData>["messages"]) {
        await this.updateState((prev) => ({ ...prev, messages: callback(this.#state.messages) }));
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
                `Cannot change agent options while the agent is '${this.#state.status}'. ` +
                `Options are only safe to mutate when the agent is idle because a generation or tool run may already be using the current configuration. ` +
                `Wait for the current run to finish, or call stop() and retry once the status is 'idle'.`
            );
        }
        this.opts = { ...this.opts, ...options };
        this.toolsToModelSettingsTools();
        // If default instructions changed, refresh merged cache
        this.updateMergedInstructionsCache();
    }

    /** Returns the current configuration options for this agent. */
    get options() { return this.opts }

    private stepOptions() { return this.opts.stepOptions as Required<StepOptions> }

    private validateStepOptions(stepOptions: StepOptions | undefined) {
        if (!stepOptions)
            return;
        const { maxStep } = stepOptions;
        if (maxStep != undefined) {
            if (maxStep <= 0)
                throw new BadUsage(`Invalid StepOptions.maxStep value '${maxStep}'. maxStep controls how many steps the agent may execute, so it must be greater than 0. Provide a positive integer such as 1 or 10.`)
        }
    }

    /**
     * Continues execution from the current message history for one or more steps.
     *
     * Use this when messages were seeded manually or when you want to continue an
     * in-progress model/tool loop without appending a new user message first.
     *
     * @param stepParams - Optional per-call limits and step overrides.
     * @returns The updated agent state after execution completes.
     *
     * @example
     * ```ts
     * const agent = fragola.agent({
     *   name: "assistant",
     *   description: "Minimal assistant",
     *   instructions: "You are a helpful assistant",
     *   messages: [{ role: "user", content: "Say hello once." }],
     * });
     *
     * await agent.step();
     * ```
     */
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
                throw new BadUsage(`Invalid stepParams.by value '${by}'. The 'by' option limits how many steps this call may execute, so it must be greater than 0. Pass a positive integer or omit 'by' to use maxStep instead.`);
            if (!rest || Object.keys(rest).length != 0)
                overrideStepOptions = rest;
        }
        if (overrideStepOptions)
            this.validateStepOptions(overrideStepOptions);
        let stepOptions: Required<StepOptions> = overrideStepOptions ? { ...defaultStepOptions, ...overrideStepOptions } as Required<StepOptions> : this.stepOptions();
        const stepCountBefore = this.#state.stepCount;
        const messagesLengthBefore = this.#state.messages.length;
        const beforeStepResult = await this.applyEvents("before:step", { options: stepOptions }); //TODO: here
        if (isStopEvent(beforeStepResult.signal))
            return this.#state;
        stepOptions = { ...defaultStepOptions, ...beforeStepResult.value } as Required<StepOptions>;
        if (this.#state.messages.length != 0)
            await this.recursiveAgent(stepOptions, () => {
                if (stepParams?.by != undefined)
                    return this.#state.stepCount == (stepCountBefore + stepParams.by);
                return false;
            }).finally(() => {
                this.abortController = undefined;
                this.stopRequested = false;
            });
        const newMessages = this.#state.messages.slice(messagesLengthBefore);
        const stepsTaken = this.#state.stepCount - stepCountBefore;
        await this.applyEvents("after:step", { options: stepOptions, newMessages, stepsTaken });
        return this.#state;
    }

    /** Resets the internal step counter to 0 without changing messages or status. */
    resetStepCount() {
        this.#state.stepCount = 0;
    }

    /**
     * Resets the agent to an idle state and replaces its message history.
     *
     * @param params - Optional replacement messages for the new state.
     * @throws {BadUsage} When called while the agent is not idle.
     */
    reset(params: ResetParams = { messages: [] }) {
        if (this.#state.status != "idle") {
            throw new BadUsage(
                `Cannot reset the agent while it is '${this.#state.status}'. ` +
                `Resetting during generation or tool execution would discard in-flight work and leave callers with an inconsistent result. ` +
                `Wait for the agent to become idle, or call stop() and retry after the current run ends.`
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

    /** Requests cancellation of the current run without awaiting completion. */
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

        type CallAPI = (modelSettings?: CreateAgentOptions["modelSettings"], clientOptions?: OpenaiClientOptions) => Promise<OpenAI.ChatCompletionAssistantMessageParam>; //TODO: move somewhere else, akward place for this type

        if (stepOptions.resetStepCountAfterUserMessage) {
            if (this.#state.messages.at(-1)?.role == "user")
                this.setStepCount(0);
        }
        if (this.#state.stepCount == stepOptions.maxStep)
            throw new MaxStepHitError(`Stopped execution because the agent reached stepOptions.maxStep (${stepOptions.maxStep}). This usually means the conversation kept looping through model responses or tool calls without reaching a stopping condition. Increase maxStep, limit the turn with step({ by: ... }), or adjust your prompt/tools so the model can finish in fewer steps.`);

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
                    throw new FragolaError("Cannot continue agent execution because the message history is invalid: a 'tool' message was found without a preceding 'assistant' message that requested it. Tool messages must directly answer an assistant tool call. Rebuild the message history so each tool message follows an assistant message with tool_calls, or reset the agent state.");
                if (!lastAiMessage.tool_calls)
                    throw new FragolaError("Cannot continue agent execution because the message history is invalid: a 'tool' message was found, but the preceding assistant message has no tool_calls. Tool messages are only valid as replies to assistant-requested tool calls. Ensure assistant messages include tool_calls before appending tool results.");

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
            const defaultModelSettings: ModelSettings = {
                ...this.modelSettings(),
                ...(stepOptions.modelSettings ?? {})
            };
            const defaultClientOptions = stepOptions.clientOptions ?? this.#instance.options;
            const callAPI: CallAPI = async (modelSettings, clientOpts) => {
                const SDK = this.#instance.sdk;
                const openai = clientOpts ? new SDK(clientOpts) : this.openai;
                const emptyAssistantMessage = { role: "assistant", content: "" } as OpenAI.ChatCompletionAssistantMessageParam;

                let { signal: configSignal, value: config } = (await this.applyEvents("before:modelInvocation", {
                    config: {
                        modelSettings: modelSettings ?? this.modelSettings(),
                        clientOptions: this.context.instance.options //TODO: check if this is correct
                    }
                }));

                if (isStopEvent(configSignal) || this.stopRequested) {
                    return emptyAssistantMessage;
                }

                const response = await (async () => {
                    if ("injectResponse" in config) {
                        return await config.injectResponse();
                    } else if ("injectMessage" in config) {
                        const injectedMessage: ChatCompletionAssistantMessageParam<TMetaData> = {
                            role: "assistant",
                            ...config.injectMessage
                        }
                        return {
                            id: `fragola-injected-${nanoid()}`,
                            object: "chat.completion" as const,
                            created: Math.floor(Date.now() / 1000),
                            model: modelSettings?.model || "NO_MODEL",
                            choices: [{ index: 0, message: injectedMessage as unknown as OpenAI.ChatCompletionMessage, finish_reason: "stop" as const, logprobs: null }],
                        } satisfies OpenAI.ChatCompletion;
                    } else {
                        if (!config.modelSettings!["model"])
                            config.modelSettings!["model"] = this.modelSettings().model;
                        const instructionsRole: ChatCompletionCreateParamsBase["messages"][0]["role"] = this.opts.useDeveloperRole ? "developer" : "system";

                        const requestBody: ChatCompletionCreateParamsBase = {
                            ...config.modelSettings as ChatCompletionCreateParamsBase,
                            messages: [{ role: instructionsRole, content: this.getMergedInstructions() }, ...stripMessagesMeta(this.#state.messages)]
                        };
                        if (this.paramsTools?.length)
                            requestBody["tools"] = this.paramsTools;
                        return await openai.chat.completions.create(requestBody, { signal: this.abortController!.signal });
                    }
                })();

                this.setGenerating();
                // Handle streaming vs non-streaming
                if (Symbol.asyncIterator in response) {
                    let partialMessage: Partial<OpenAI.Chat.ChatCompletionMessageParam> = {
                        role: "assistant",
                        content: ""
                    };
                    let replaceLast = false;
                    const createProcesschunk = (): (chunk: OpenAI.Chat.Completions.ChatCompletionChunk | ChatCompletionChunk) => Promise<OpenAI.Chat.Completions.ChatCompletionChunk | ChatCompletionChunk> => {
                        if (EmodelInvocation) {
                            return async (chunk: OpenAI.Chat.Completions.ChatCompletionChunk | ChatCompletionChunk) => {
                                const eModelInvocation = await this.applyEvents("modelInvocation", {
                                    kind: "chunk",
                                    chunk,
                                    primaryChoice: chunk.choices[0],
                                    delta: chunk.choices[0]?.delta,
                                }, EmodelInvocation);
                                if (isStopEvent(eModelInvocation.signal))
                                    return eModelInvocation.signal as any;
                                return eModelInvocation.value as any;
                            }
                        } else
                            return async (chunk) => chunk;
                    }
                    const processchunk = createProcesschunk();
                    for await (const chunk of response) {
                        let _chunk = await processchunk(chunk);
                        if (isStopEvent(_chunk))
                            break;
                        if (_chunk.choices.length > 0)
                            partialMessage = streamChunkToMessage(_chunk, partialMessage);
                        const finish_reason = _chunk.choices[0]?.finish_reason ?? null;
                        const partialMessageFinal = await this.applyEvents("aiMessage", {
                            message: partialMessage as typeof aiMessage,
                            finish_reason,
                            usage: _chunk.usage
                        });
                        if (isStopEvent(partialMessageFinal.signal))
                            break;
                        await this.appendMessages([partialMessageFinal.value as OpenAI.Chat.ChatCompletionMessageParam], replaceLast);
                        replaceLast = true;
                    }
                    this.abortController = undefined;
                    aiMessage = (partialMessage) as typeof aiMessage;
                } else {
                    this.abortController = undefined;
                    const messageProcessed = await this.applyEvents("aiMessage", {
                        message: (response.choices[0]?.message || emptyAssistantMessage) as typeof aiMessage,
                        finish_reason: response.choices[0]?.finish_reason,
                        usage: response.usage
                    });
                    if (isStopEvent(messageProcessed.signal))
                        return emptyAssistantMessage;
                    aiMessage = messageProcessed.value as typeof aiMessage;
                    await this.appendMessages([aiMessage], false);
                }
                this.setStepCount(this.#state.stepCount + 1);

                let stepEventOptions: Required<StepOptions> | undefined;
                if (stepEventOptions)
                    stepEventOptions = stepEventOptions;

                await this.applyEvents("after:modelInvocation", { message: aiMessage });
                if (aiMessage.role == "assistant" && aiMessage.tool_calls && aiMessage.tool_calls.length)
                    toolCalls = aiMessage.tool_calls;
                return aiMessage;
            }
            await callAPI(defaultModelSettings, defaultClientOptions);
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
                    throw new FragolaError(`Cannot execute tool call '${toolCall.function.name}' because no tool with that name is registered on this agent. The model asked for a tool that is unavailable in opts.tools. Register the tool, rename it to match the exposed tool name, or remove the stale tool call from the message history.`);

                let paramsParsed: z.SafeParseReturnType<any, any> | undefined;
                let rawParams: any;
                //TODO: for the errors, indicate if it is zod or schema string
                if (tool.schema) {
                    if (typeof tool.schema === 'string') {
                        // If schema is a string, no validation - we just parse the arguments
                        try {
                            rawParams = JSON.parse(toolCall.function.arguments);
                        } catch {
                            throw new FragolaError(`Cannot execute tool '${tool.name}' because the model produced arguments that are not valid JSON. Tool arguments are expected to be a JSON string, and JSON.parse failed for the generated payload. Tighten the tool schema or description, inspect toolCall.function.arguments, or rewrite the params in 'before:toolCall'.`);
                        }
                    } else {
                        // If schema is a Zod schema, validate
                        paramsParsed = (tool.schema as z.Schema).safeParse(JSON.parse(toolCall.function.arguments));
                        if (!paramsParsed.success) {
                            throw new FragolaError(`Cannot execute tool '${tool.name}' because the model produced arguments that do not match the tool schema. Validation failed for ${formatZodIssues(paramsParsed.error.issues)}. Update the tool schema or description so the model can produce the expected shape, or rewrite the params in 'before:toolCall'.`);
                        }
                    }
                }

                const params = paramsParsed?.data ?? rawParams;
                const beforeToolCallResult = await this.applyEvents("before:toolCall", { config: { params }, tool: tool as any });
                if (isStopEvent(beforeToolCallResult.signal))
                    break;

                const beforeConfig = beforeToolCallResult.value;
                const injectedResult = beforeConfig && "injectResult" in beforeConfig ? beforeConfig.injectResult : undefined;
                const effectiveParams = injectedResult !== undefined ? params : (beforeConfig as { params: any })?.params ?? params;

                const rawResult = await (async () => {
                    if (injectedResult !== undefined)
                        return injectedResult;
                    if (tool.handler == "dynamic")
                        throw new BadUsage(`Cannot execute tool '${tool.name}' because it uses handler: 'dynamic' but no result was injected. Dynamic tools do not run a local handler and must receive { injectResult } from a 'before:toolCall' event. Register that event or replace the dynamic handler with a concrete function.`);
                    return isAsyncFunction(tool.handler) ? await tool.handler(effectiveParams, this.context as any) : tool.handler(effectiveParams, this.context as any);
                })();

                const eventToolResult = await this.applyEvents("toolCall", { result: rawResult, params: effectiveParams, tool: tool as any });
                if (isStopEvent(eventToolResult.signal))
                    break;
                const content = eventToolResult.value;
                const afterToolCallResult = await this.applyEvents("after:toolCall", { result: content, params: effectiveParams, tool: tool as any });

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
                await this.updateMessages((prev) => [...prev, message]);
                if (isStopEvent(afterToolCallResult.signal))
                    break;
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

    /**
     * Appends a user message, requests structured JSON output, and validates it against a Zod schema.
     *
     * @param query - The user prompt, schema, and optional per-call step overrides.
     * @returns The schema validation result together with the final agent state.
     *
     * @example
     * ```ts
     * const result = await agent.json({
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
    async json<S extends z.ZodTypeAny = z.ZodTypeAny>(query: JsonQuery<S>): Promise<JsonResult<S, TMetaData>> {
        const { step, name, schema, strict, description, ignoreUserMessageEvents, ...message } = query;
        let _step = { ...step };
        let _message: Omit<ChatCompletionUserMessageParam<TMetaData>, "role">;
        if (ignoreUserMessageEvents)
            _message = message as Omit<ChatCompletionUserMessageParam<TMetaData>, "role">;
        else {
            const userMessageProcessed = await this.applyEvents("userMessage", { message: message as Omit<ChatCompletionUserMessageParam<TMetaData>, "role"> });
            if (isStopEvent(userMessageProcessed.signal))
                throw new JsonModeError(`JSON generation stopped before the model was called because a 'userMessage' event handler returned stop(). The json() pipeline requires the user message to reach the model. Remove that stop condition for this path, or set ignoreUserMessageEvents: true to bypass userMessage handlers for this call.`);
            _message = userMessageProcessed.value as typeof _message;
        }
        const userMessage = { role: "user", ..._message } as ChatCompletionMessageParam<TMetaData>;
        await this.updateMessages((prev) => [...prev, userMessage]);
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
        const state = await this.step(_step);
        const lastAiMessage = this.lastAiMessage(state.messages);
        if (!lastAiMessage)
            throw new JsonModeError(`JSON generation failed because no assistant message was produced after step() completed. The json() helper expects the final message to be an assistant response containing the JSON payload. Check whether an event stopped execution early, a tool loop consumed the turn, or the message history was modified unexpectedly.`);
        if (typeof lastAiMessage.content != 'string') {
            throw new JsonModeError(`JSON generation failed because the assistant response content is '${typeof lastAiMessage.content}', not a string. The json() helper can only parse plain text JSON. Ensure the model returns raw JSON text and that no event replaces the assistant content with structured parts or tool calls.`);
        }
        try {
            const jsonParsed = JSON.parse(lastAiMessage.content);
            const parsed = schema.safeParse(jsonParsed);
            return { ...parsed, state };
        } catch (error) {
            const preview = lastAiMessage.content.replace(/\s+/g, " ").slice(0, 200);
            throw new JsonModeError(`JSON generation failed because the assistant response was not valid JSON. JSON.parse raised: ${formatUnknownError(error)}. Response preview: ${JSON.stringify(preview)}. Ensure your instructions and schema require raw JSON with no extra prose, or normalize the response in an event handler before calling json().`);
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
        const userMessageFinal = await this.applyEvents("userMessage", { message: message as Omit<ChatCompletionUserMessageParam<TMetaData>, "role"> }) as ApplyEventResult<EventUserMessage<TMetaData, TGlobalStore, TStore>>;
        if (isStopEvent(userMessageFinal.signal))
            return this.#state;
        await this.updateMessages((prev) => [...prev, userMessageFinal.value as ChatCompletionMessageParam<TMetaData>]);
        return await this.step(query.step);
    }

    /**
     * Will call every registered events via on* methods for `eventId` and pass the parameters `_params` to the callbacks
     * @param eventId - the id of the event
     * @param _params  - the parameters to pass to the callback
     * @returns 
     */
    private async applyEvents<TEventId extends AgentEventId>(eventId: TEventId, _params: applyEventParams<TEventId, TMetaData>, _events?: registeredEvent<NoInfer<TEventId>, TMetaData, TGlobalStore, TStore>[], accumulate?: AccumulateCallback<any>): Promise<appliedEvent<TEventId, TMetaData, TGlobalStore, TStore>> {
        const events = _events ?? this.registeredEvents.get(eventId) ?? [];
        const params = _params as any;
        switch (eventId) {
            case "userMessage":
                return await applyUserMessage(events as any, this.context, params, accumulate) as any;
            case "before:step":
                return await applyBeforeStep(events as any, this.context, params, accumulate) as any;
            case "before:modelInvocation":
                return await applyBeforeModelInvocation(events as any, this.context, params, accumulate) as any;
            case "modelInvocation":
                return await applyModelInvocation(events as any, this.context, params, accumulate) as any;
            case "after:modelInvocation":
                return await applyAfterModelInvocation(events as any, this.context, params, accumulate) as any;
            case "before:toolCall":
                return await applyBeforeToolCall(events as any, this.context, params, accumulate) as any;
            case "toolCall":
                return await applyToolCall(events as any, this.context, params, accumulate) as any;
            case "after:toolCall":
                return await applyAfterToolCall(events as any, this.context, params, accumulate) as any;
            case "aiMessage":
                return await applyAiMessage(events as any, this.context, params, accumulate) as any;
            case "after:stateUpdate":
                return await applyAfterStateUpdate(events as any, this.context, accumulate) as any;
            case "after:step":
                return await applyAfterStep(events as any, this.context, params, accumulate) as any;
            default:
                throw new FragolaError(`Internal error: applyEvents received unknown event '${eventId}'. This means the agent dispatched an event id that is not handled in Agent.applyEvents(). Add a matching case for '${eventId}' or verify that only valid AgentEventId values are being registered and dispatched.`)
        }
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
    on<TEventId extends AgentEventId>(eventId: TEventId, callback: eventIdToCallback<TEventId, TMetaData, TGlobalStore, TStore>) {
        type EventTargetType = registeredEvent<TEventId, TMetaData, TGlobalStore, TStore>;
        const events = this.registeredEvents.get(eventId) || [] as EventTargetType[];
        const id = nanoid();
        events.push({
            id,
            callback: callback,
            sourceHookId: this.activeHookSourceId
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
     * Register a tool result handler.
     *
     * This event runs after `before:toolCall` resolves the current config and after the tool
     * handler (or an injected result) produces a value. Each callback receives the current result
     * and may transform it before it is exposed to later `toolCall` handlers, `after:toolCall`,
     * and the tool message appended to state.
     *
     * Return `skip()` to keep the current result unchanged, or `context.stop()` to stop the
     * remaining `toolCall` / `after:toolCall` pipeline for the current tool call.
     *
     * @example
     * agent.onToolCall((result, params, tool) => {
     *   if (tool.name !== "getWeather") return result;
     *   return {
     *     requestedLocation: params.location,
     *     data: result,
     *   };
     * });
     */
    onToolCall<TParams = Record<any, any>>(callback: EventToolCall<TParams, TMetaData, TGlobalStore, TStore>) { return this.on("toolCall", callback) }

    /**
     * Register an assistant message handler.
     *
     * This event runs for streamed partial assistant messages and for the final assistant message.
     * During streaming, `finish_reason` is `null` until the stream completes.
     *
     * Return a new assistant message to replace the current one, `skip()` to leave it unchanged,
     * or `context.stop()` to stop processing the current assistant message.
     *
     * @example
     * agent.onAiMessage((message, finish_reason) => {
     *   if (finish_reason === null) return message;
     *   if (typeof message.content !== "string") return message;
     *   return {
     *     ...message,
     *     content: message.content.trim() + "\n\n(checked)",
     *   };
     * });
     */
    onAiMessage(callback: EventAiMessage<TMetaData, TGlobalStore, TStore>) { return this.on("aiMessage", callback) }

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
    onUserMessage(callback: EventUserMessage<TMetaData, TGlobalStore, TStore>) { return this.on("userMessage", callback) }

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
    onBeforeStep(callback: EventBeforeStep<TMetaData, TGlobalStore, TStore>) { return this.on("before:step", callback) }

    /**
     * Register an after step event handler.
     *
     * Called after a step is executed.
     *
         * @example
         * agent.onAfterStep((options, newMessages, stepsTaken, context) => {
         *   console.log('After step', options, newMessages, stepsTaken);
     * });
     */
    onAfterStep(callback: EventAfterStep<TMetaData, TGlobalStore, TStore>) { return this.on("after:step", callback) }

    /**
         * Register a handler that can alter model invocation config before the request is made.
     *
         * The callback receives the current invocation config and may:
         * - return `{ modelSettings, clientOptions }` to override the request settings
         * - return `{ injectMessage }` to bypass the API call with a final assistant message
         * - return `{ injectResponse }` to provide a custom SDK response
         * - return `skip()` to leave the current config unchanged
         * - return `context.stop()` to cancel the invocation
     *
     * @example
         * agent.onBeforeModelInvocation(() => ({
         *   injectMessage: { content: "hello from cache" },
         * }));
     */
    onBeforeModelInvocation(callback: EventBeforeModelInvocation<TMetaData, TGlobalStore, TStore>) { return this.on("before:modelInvocation", callback) }

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
    onAfterModelInvocation(callback: EventAfterModelInvocation<TMetaData, TGlobalStore, TStore>) { return this.on("after:modelInvocation", callback) }

     /**
      * Register a handler that can alter a tool call before execution.
      *
      * The callback receives `{ params }` before the tool handler runs. It may return a new
      * `{ params }` object to rewrite validated arguments or `{ injectResult }` to bypass the
      * handler entirely. `skip()` preserves the current config, and `context.stop()` aborts the
      * current tool call.
      *
      * @example
      * agent.onBeforeToolCall((config, tool) => {
      *   if (tool.name !== "search" || !("params" in config)) return config;
      *   return { params: { ...config.params, limit: 5 } };
      * });
      */
    onBeforeToolCall<TParams = Record<any, any>>(callback: EventBeforeToolCall<TParams, TMetaData, TGlobalStore, TStore>) { return this.on("before:toolCall", callback) }

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
    onAfterToolCall<TParams = Record<any, any>>(callback: EventAfterToolCall<TParams, TMetaData, TGlobalStore, TStore>) { return this.on("after:toolCall", callback) }

     /**
      * Register a model invocation handler.
      *
      * Use this event to inspect or transform data produced by the model before it is
      * turned into the assistant message stored in state.
      *
      * Handle the payload as a discriminated union by checking `invocation.kind`:
      * - `"chunk"`: streamed delta payload. The callback receives
      *   `{ kind, chunk, primaryChoice, delta }` before that chunk is merged into the
      *   partial assistant message.
      * - `"completion"`: full assistant message payload. The callback receives
      *   `{ kind: "completion", data }`, where `data` is the complete assistant message.
      *
      * For `kind === "chunk"`, you may:
      * - return the raw chunk to replace it directly
      * - return `{ injectChunk, merge?: true }` to update the whole chunk
      * - return `{ injectPrimary, merge?: true }` to update `choices[0]`
      * - return `{ injectDelta, merge?: true }` to update `choices[0].delta`
      * - set `merge: false` on any `inject*` object to replace that target instead of merge-patching it
      *
      * For `kind === "completion"`, return the assistant message unchanged or return an
      * updated message object.
      *
      * In both branches, you can also return `skip()` to leave the payload unchanged or
      * `context.stop()` to abort further processing.
      *
      * @example
      * agent.onModelInvocation((invocation) => {
      *   if (invocation.kind === "completion") {
      *     if (typeof invocation.data.content !== "string") return invocation.data;
      *     return {
      *       ...invocation.data,
      *       content: invocation.data.content.trim(),
      *     };
      *   }
      *
      *   if (!invocation.delta?.content) return invocation.chunk;
      *
      *   return {
      *     injectDelta: {
      *       content: invocation.delta.content.replace("[DEBUG]", ""),
      *     },
      *   };
      * });
      */
    onModelInvocation(callback: EventModelInvocation<TMetaData, TGlobalStore, TStore>) { return this.on("modelInvocation", callback) }

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
    onAfterStateUpdate(callback: EventAfterStateUpdate<TMetaData, TGlobalStore, TStore>) { return this.on("after:stateUpdate", callback) };

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
    * import { Hook } from "@fragola-ai/agentic-sdk-core/hook";
    *
    * const loggingHook = Hook((agent) => {
    *   agent.onAfterStateUpdate((context) => {
    *     console.log(context.state.status);
    *   });
    * });
    *
    * const agent = fragola.agent({...}).use(loggingHook, "logging");
     * // agent is returned so additional configuration/calls can be chained
     * ```
     */
    use(hook: FragolaHook, name?: string) {
        if (name && (this.pendingHookNames.has(name) || this.hookDisposeMap.has(name))) {
            throw new BadUsage(`Cannot register hook '${name}' because a hook with that name is already registered or still initializing. Hook names must be unique so hooks can be removed deterministically. Use a different name, wait for the pending hook to finish, or call removeHook('${name}') before registering it again.`);
        }

        const sourceHookId = nanoid();

        if (name) {
            this.pendingHookNames.add(name);
        }

        // Chain initialization so multiple hooks initialize in sequence.
        // Accepts both sync and async hooks.
        this.hooksLoaded = this.hooksLoaded
            .then(async () => {
                this.activeHookSourceId = sourceHookId;
                try {
                    return await Promise.resolve(hook(this as AgentAny));
                } finally {
                    this.activeHookSourceId = undefined;
                }
            })
            .then((dispose) => {
                this.hooks.push({ hook, name, sourceHookId });

                if (!name) {
                    return;
                }

                this.pendingHookNames.delete(name);
                this.hookDisposeMap.set(name, dispose ?? NOOP_HOOK_DISPOSE);
            })
            .catch((err) => {
                if (name) {
                    this.pendingHookNames.delete(name);
                }
                // don't break chain on error, but surface a warning
                console.error("Failed to initialize hook:", err);
            });
        return this;
    }

    /**
     * Returns whether a named hook is registered. Pending hooks count as registered.
     */
    hasHook(name: string): boolean {
        return this.pendingHookNames.has(name) || this.hookDisposeMap.has(name);
    }

    /**
     * Removes a named hook, waits for pending setup to finish, and runs its disposer.
     * Returns `false` if no hook is registered under that name.
     */
    async removeHook(name: string): Promise<boolean> {
        await this.hooksLoaded;

        const dispose = this.hookDisposeMap.get(name);
        if (!dispose)
            return false;

        this.hookDisposeMap.delete(name);
        //TODO: maybe use a faster way than an array for the hooks. to avoid using filter
        this.hooks = this.hooks.filter((entry) => entry.name !== name);

        await dispose();
        return true;
    }
}

export type AgentAny = Agent<any, any, any>;