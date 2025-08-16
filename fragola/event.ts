import type OpenAI from "openai/index.js";
import type { AgentContext, AgentState } from "./agent";
import type { Store } from "./store";
import type { Prettify, StoreLike, maybePromise } from "./types";
import type { Tool, ToolHandlerReturnType } from "./fragola";

export type AgentDefaultEventId =
  "apiCall" | "stateUpdate" | "modelInvocation" | "toolCall" | "aiMessage" | "userMessage";

export type AgentAfterEventId = `after:${AgentDefaultEventId | "conversationUpdate"}`;

export const SKIP_EVENT = Symbol('skip_event');
/**
 * When returned from an event handler, the event will be ignored and the default behavior will be applied instead.
 * 
 * @returns An object with the SKIP_EVENT symbol that signals the event system to skip this event
 */
export const skip = () => ({SKIP_EVENT: true});
export type eventResult<T> = T | typeof skip;

export type AgentEventId = AgentDefaultEventId | AgentAfterEventId;

export type EventToolCall<TParams = Record<any, any>, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}>
  = (params: TParams, tool: Tool<any>, context: AgentContext<TGlobalStore, TStore>)
    => maybePromise<eventResult<ToolHandlerReturnType>>

export type EventAiMessage<TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> = (message: OpenAI.ChatCompletionAssistantMessageParam, isGenerating: boolean, context: AgentContext<TGlobalStore, TStore>) => maybePromise<eventResult<OpenAI.ChatCompletionAssistantMessageParam>>;

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