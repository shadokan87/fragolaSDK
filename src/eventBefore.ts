import type { AgentDefaultEventId } from "./event";
import type { maybePromise, StoreLike } from "./types";
import type { AgentContext } from "@src/agentContext";
import type { OpenaiClientOptions, DefineMetaData, Tool, ChatCompletionAssistantMessageParam } from "./fragola";
import type { CreateAgentOptions, StepOptions } from "./agent";
import type OpenAI from "openai";
import type { APIPromise } from "openai";
import type { Stream } from "openai/streaming";

export type AgentBeforeEventId = `before:${AgentDefaultEventId}`;

export type EventBeforeStep<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    options: Required<StepOptions>,
    context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<void>;

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

export type EventBeforeToolCall<TParams = Record<any, any>, TMetaData extends DefineMetaData<any> = {}, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> = (
    params: TParams,
    tool: Tool<any>,
    context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<void>;

//@prettier-ignore
export type callbackMap<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
    [K in AgentBeforeEventId]:
    K extends "before:step" ? EventBeforeStep<TMetaData, TGlobalStore, TStore> :
    K extends "before:modelInvocation" ? EventBeforeModelInvocation<TMetaData, TGlobalStore, TStore> :
    K extends "before:toolCall" ? EventBeforeToolCall<any, TMetaData, TGlobalStore, TStore> :
    never;
};
