import type { AgentDefaultEventId, eventResult } from "./event";
import type { maybePromise, StoreLike } from "./types";
import type { AgentContext } from "@src/agentContext";
import type { OpenaiClientOptions, DefineMetaData, Tool, ChatCompletionAssistantMessageParam } from "./fragola";
import type { ToolCallPayload } from "./eventDefault";
import type { CreateAgentOptions, StepOptions } from "./agent";
import type OpenAI from "openai";
import type { APIPromise } from "openai";
import type { Stream } from "openai/streaming";

export type AgentBeforeEventExclusive = "before:step";

export type AgentBeforeEventId = `before:${AgentDefaultEventId}` | AgentBeforeEventExclusive;

export type EventBeforeStep<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    options: StepOptions,
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

export type EventBeforeModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    config: ModelInvocationConfig<TMetaData>,
    context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<ModelInvocationConfig<TMetaData>>;

export type ToolCallConfig<TParams = Record<any, any>> =
    | { params: TParams }
    | { injectConfig: ToolCallPayload };

export type EventBeforeToolCall<TParams = Record<any, any>, TMetaData extends DefineMetaData<any> = {}, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> = (
    config: ToolCallConfig<TParams>,
    tool: Tool<any>,
    context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<ToolCallConfig<TParams>>;

//@prettier-ignore
export type callbackMap<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
    [K in AgentBeforeEventId]:
    K extends "before:step" ? EventBeforeStep<TMetaData, TGlobalStore, TStore> :
    K extends "before:modelInvocation" ? EventBeforeModelInvocation<TMetaData, TGlobalStore, TStore> :
    K extends "before:toolCall" ? EventBeforeToolCall<any, TMetaData, TGlobalStore, TStore> :
    never;
};
