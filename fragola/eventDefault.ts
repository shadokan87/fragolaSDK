import type OpenAI from "openai/index.js";
import type { CreateAgentOptions, AgentContext } from "./agent";
import type { maybePromise, StoreLike } from "./types";
import type { AgentDefaultEventId, eventResult } from "./event";
import type { ClientOptions } from "openai/index.js";
import type { ChatCompletionAssistantMessageParam, ChatCompletionUserMessageParam, DefineMetaData, Tool, ToolHandlerReturnTypeNonAsync } from "./fragola";

export type CallAPIProcessChuck = (chunck: OpenAI.ChatCompletionChunk, partialMessage: OpenAI.ChatCompletionAssistantMessageParam) => maybePromise<OpenAI.ChatCompletionChunk>;
export type CallAPI = (processChunck?: CallAPIProcessChuck, modelSettings?: CreateAgentOptions["modelSettings"], clientOptions?: ClientOptions) => Promise<OpenAI.ChatCompletionAssistantMessageParam>

export type EventModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    callAPI: CallAPI,
    context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<OpenAI.ChatCompletionAssistantMessageParam>;

export type EventToolCall<TParams = Record<any, any>, TMetaData extends DefineMetaData<any> = {},TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}>
  = (params: TParams, tool: Tool<any>, context: AgentContext<TMetaData, TGlobalStore, TStore>)
    => maybePromise<eventResult<ToolHandlerReturnTypeNonAsync>>

export type EventAiMessage<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> = (message: ChatCompletionAssistantMessageParam<TMetaData>, isGenerating: boolean, context: AgentContext<TMetaData, TGlobalStore, TStore>) => maybePromise<eventResult<ChatCompletionAssistantMessageParam>>;
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