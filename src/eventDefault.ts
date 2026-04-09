import type OpenAI from "openai/index.js";
import type { CreateAgentOptions } from "./agent";
import type { AgentContext } from "@src/agentContext";
import type { maybePromise, StoreLike } from "./types";
import type { AgentDefaultEventId, eventResult } from "./event";
import type { ClientOptions } from "openai/index.js";
import type { ChatCompletionAssistantMessageParam, ChatCompletionUserMessageParam, DefineMetaData, Tool, ToolHandlerReturnTypeNonAsync } from "./fragola";
import type { StepOptions } from "./agent";

export type ModelInvocationKind = "chunck" | "completion";

export type EventModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
  kind: ModelInvocationKind,
  data: OpenAI.ChatCompletionChunk | ChatCompletionAssistantMessageParam<TMetaData>,
  context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<eventResult<OpenAI.ChatCompletionChunk | ChatCompletionAssistantMessageParam<TMetaData>>>;

export type EventToolCall<TParams = Record<any, any>, TMetaData extends DefineMetaData<any> = {}, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}>
  = (params: TParams, tool: Tool<any>, context: AgentContext<TMetaData, TGlobalStore, TStore>)
    => maybePromise<eventResult<ToolHandlerReturnTypeNonAsync>>

export type EventAiMessage<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> = (message: ChatCompletionAssistantMessageParam<TMetaData>, isPartial: boolean, context: AgentContext<TMetaData, TGlobalStore, TStore>) => maybePromise<eventResult<ChatCompletionAssistantMessageParam>>;
export type EventUserMessage<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> = (message: ChatCompletionUserMessageParam<TMetaData>, context: AgentContext<TMetaData, TGlobalStore, TStore>) => maybePromise<eventResult<ChatCompletionUserMessageParam>>;

//@prettier-ignore
export type callbackMap<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
  [K in AgentDefaultEventId]:
  K extends "aiMessage" ? EventAiMessage<TMetaData, TGlobalStore, TStore> :
  K extends "userMessage" ? EventUserMessage<TMetaData, TGlobalStore, TStore> :
  K extends "toolCall" ? EventToolCall<any, TMetaData, TGlobalStore, TStore> :
  K extends "modelInvocation" ? EventModelInvocation<TMetaData, TGlobalStore, TStore> :
  never;
};
