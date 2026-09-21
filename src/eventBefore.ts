import type { AgentDefaultEventId, eventResult } from "./event";
import type { AgentContext } from "./agentContext";
import type { maybePromise, StoreLike } from "./types";
import type { OpenaiClientOptions, DefineMetaData, Tool, ChatCompletionAssistantMessageParam } from "./fragola";
import type { ToolCallPayload } from "./eventDefault";
import type { CreateAgentOptions, StepOptions } from "./agent";
import type OpenAI from "openai";
import type { APIPromise } from "openai";
import type { Stream } from "openai/streaming";

export type AgentBeforeEventExclusive = "before:step";

export type AgentBeforeEventId = `before:${AgentDefaultEventId}` | AgentBeforeEventExclusive;

export type EventBeforeStepPayload = {
    options: StepOptions;
};

export type EventBeforeStep<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    payload: EventBeforeStepPayload,
    context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<eventResult<StepOptions>>;

export type InjectResponse = () => APIPromise<Stream<OpenAI.Chat.Completions.ChatCompletionChunk> | OpenAI.Chat.Completions.ChatCompletion>;

export type ModelInvocationConfig<TMetaData extends DefineMetaData<any> = {}> = {
    modelSettings: CreateAgentOptions["modelSettings"],
    clientOptions: OpenaiClientOptions
} | {
    injectResponse: InjectResponse;
} | {
    injectMessage: Omit<ChatCompletionAssistantMessageParam<TMetaData>, "role">,
}

export type EventBeforeModelInvocationPayload<TMetaData extends DefineMetaData<any>> = {
    config: ModelInvocationConfig<TMetaData>
};

export type EventBeforeModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    payload: EventBeforeModelInvocationPayload<TMetaData>,
    context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<eventResult<ModelInvocationConfig<TMetaData>>>;

export type ToolCallConfig =
    | { params: Record<string, any> }
    | { injectConfig: ToolCallPayload };

export type EventBeforeToolCallPayload<TMetaData extends DefineMetaData<any> = {}> = {
    toolCall: { readonly name: string, readonly id: string };
    config: ToolCallConfig;
    tool: Tool<any> | undefined;
};

export type EventBeforeToolCall<TMetaData extends DefineMetaData<any> = {}, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> = (
    payload: EventBeforeToolCallPayload<TMetaData>,
    context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<eventResult<ToolCallConfig>>;

//@prettier-ignore
export type callbackMap<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
    [K in AgentBeforeEventId]:
    K extends "before:step" ? EventBeforeStep<TMetaData, TGlobalStore, TStore> :
    K extends "before:modelInvocation" ? EventBeforeModelInvocation<TMetaData, TGlobalStore, TStore> :
    K extends "before:toolCall" ? EventBeforeToolCall<TMetaData, TGlobalStore, TStore> :
    never;
};
