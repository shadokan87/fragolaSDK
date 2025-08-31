import type OpenAI from "openai/index.js";
import type { AgentContext, AgentState } from "./agent";
import type { Store } from "./store";
import type { Prettify, StoreLike, maybePromise } from "./types";
import type { ChatCompletionAssistantMessageParam, DefineMetaData, Tool, ToolHandlerReturnType, ToolHandlerReturnTypeNonAsync } from "./fragola";

export type AgentDefaultEventId =
  "apiCall" | "stateUpdate" | "modelInvocation" | "toolCall" | "aiMessage" | "userMessage";

export type AgentAfterEventId = `after:${AgentDefaultEventId | "conversationUpdate"}`;

export const SKIP_EVENT = Symbol('skip_event');
/**
 * When returned from an event handler, the event will be ignored.
 * 
 * @returns An object with the SKIP_EVENT symbol that signals the event system to skip this event
 */
export const skip = () => ({[SKIP_EVENT]: true});
export type eventResult<T> = T | ReturnType<typeof skip>;

export type AgentEventId = AgentDefaultEventId | AgentAfterEventId;

export type EventDefaultCallback<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
  context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<void>;