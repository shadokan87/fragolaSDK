import type OpenAI from "openai/index.js";
import type { AgentContext, AgentState } from "./agent";
import type { Store } from "./store";
import type { StoreLike, maybePromise } from "./types";

export type AgentDefaultEventId =
  "conversationUpdate" | "apiCall" | "stateUpdate" | "modelInvocation"; //| "toolCall";

export type AgentAfterEventId = `after:${AgentDefaultEventId}`;

export type AgentEventId = AgentDefaultEventId | AgentAfterEventId;

export type EventDefaultCallback<TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
      context: AgentContext<TGlobalStore, TStore>
) => maybePromise<void>;