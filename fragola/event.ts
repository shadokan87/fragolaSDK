import type OpenAI from "openai/index.js";
import type { AgentContext, AgentState } from "./agent";
import type { Store } from "./store";
import type { StoreLike, maybePromise } from "./types";

export type AgentDefaultEventId =
  "conversationUpdate" | "apiCall" | "stateUpdate" | "providerAPI"; //| "toolCall";


export type AgentBeforeEventId = `before:${AgentDefaultEventId}`;

export type AgentAfterEventId = `after:${AgentDefaultEventId}`;

export type AgentEventId = AgentDefaultEventId | AgentBeforeEventId | AgentAfterEventId;

export type EventDefaultCallback = (
      context: AgentContext
) => maybePromise<void>;