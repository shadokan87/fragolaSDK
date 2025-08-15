import type OpenAI from "openai/index.js";
import type { AgentContext, AgentState } from "./agent";
import type { Store } from "./store";
import type { Prettify, StoreLike, maybePromise } from "./types";
import type { Tool, ToolHandlerReturnType } from "./fragola";

export type AgentDefaultEventId =
  "apiCall" | "stateUpdate" | "modelInvocation" | "toolCall" | "aiMessage" | "userMessage";

export type AgentAfterEventId = `after:${AgentDefaultEventId | "conversationUpdate"}`;

export const WHEN_EVENT_MODIFIER = Symbol('whenEventModifier');
export type AgentEventId = AgentDefaultEventId | AgentAfterEventId;

type WhenEventModifier<T> = (expression: boolean, callback: maybePromise<T>) => { [WHEN_EVENT_MODIFIER]: boolean, expression: boolean, callback: maybePromise<T> };

export type EventToolCall<TParams = Record<any, any>, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}>
  = (params: TParams, tool: Tool<any>, context: AgentContext<TGlobalStore, TStore>, when: WhenEventModifier<ToolHandlerReturnType>)
    => maybePromise<ToolHandlerReturnType | ReturnType<typeof when>>;

export type EventAiMessage<TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> = (message: OpenAI.ChatCompletionAssistantMessageParam, isGenerating: boolean, context: AgentContext<TGlobalStore, TStore>) => maybePromise<OpenAI.ChatCompletionAssistantMessageParam | WhenEventModifier<OpenAI.ChatCompletionAssistantMessageParam>>;

// const eventAiMessageTwo: EventAiMessage = (message, isGenerating) => when(true, () => {
//   message.content = "(modified)";
//   return message;
// })

// const eventAiMessage: EventAiMessage = (message, isGenerating) => ({
//   when: !isGenerating,
//   then: () => {
//     message.content = "(modified)";
//     return message;
//   }
// })

export type EventDefaultCallback<TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
  context: AgentContext<TGlobalStore, TStore>
) => maybePromise<void>;