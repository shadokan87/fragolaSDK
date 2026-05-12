import type OpenAI from "openai/index.js";
import type { CreateAgentOptions } from "./agent";
import type { AgentContext } from "@src/agentContext";
import type { maybePromise, ContextLike } from "./types";
import type { AgentDefaultEventId, eventResult } from "./event";
import type { ClientOptions } from "openai/index.js";
import type { ChatCompletionAssistantMessageParam, ChatCompletionUserMessageParam, DefineMetaData, Tool, ToolHandlerReturnTypeNonAsync } from "./fragola";
import type { StepOptions } from "./agent";

export type ModelInvocationKind = "chunk" | "completion";

export type ModelInvocationPayload<TMetaData extends DefineMetaData<any>> =
  | {
      kind: "chunk";
      data: OpenAI.ChatCompletionChunk;
    }
  | {
      kind: "completion";
      data: ChatCompletionAssistantMessageParam<TMetaData>;
    };

export type EventModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any>, TContext extends ContextLike<any>> = (
  payload: ModelInvocationPayload<TMetaData>,
  context: AgentContext<TMetaData, TGlobalContext, TContext>
) => maybePromise<eventResult<ModelInvocationPayload<TMetaData>["data"]>>;

export type EventToolCall<TParams = Record<any, any>, TMetaData extends DefineMetaData<any> = {}, TGlobalContext extends ContextLike<any> = {}, TContext extends ContextLike<any> = {}>
  = (result: ToolHandlerReturnTypeNonAsync, params: TParams, tool: Tool<any>, context: AgentContext<TMetaData, TGlobalContext, TContext>)
    => maybePromise<eventResult<ToolHandlerReturnTypeNonAsync>>

export type EventAiMessage<TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any> = {}, TContext extends ContextLike<any> = {}> = (message: ChatCompletionAssistantMessageParam<TMetaData>, finish_reason: OpenAI.Chat.Completions.ChatCompletionChunk.Choice['finish_reason'], usage: OpenAI.Chat.Completions.ChatCompletionChunk['usage'], context: AgentContext<TMetaData, TGlobalContext, TContext>) => maybePromise<eventResult<ChatCompletionAssistantMessageParam>>;
export type EventUserMessage<TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any> = {}, TContext extends ContextLike<any> = {}> = (message: ChatCompletionUserMessageParam<TMetaData>, context: AgentContext<TMetaData, TGlobalContext, TContext>) => maybePromise<eventResult<ChatCompletionUserMessageParam>>;

//@prettier-ignore
export type callbackMap<TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any>, TContext extends ContextLike<any>> = {
  [K in AgentDefaultEventId]:
  K extends "aiMessage" ? EventAiMessage<TMetaData, TGlobalContext, TContext> :
  K extends "userMessage" ? EventUserMessage<TMetaData, TGlobalContext, TContext> :
  K extends "toolCall" ? EventToolCall<any, TMetaData, TGlobalContext, TContext> :
  K extends "modelInvocation" ? EventModelInvocation<TMetaData, TGlobalContext, TContext> :
  never;
};
