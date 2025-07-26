import type OpenAI from "openai/index.js";
import type { AgentState } from "./agent";
import type { Store } from "./store";
import type { StoreLike, maybePromise } from "./types";

export type AgentDefaultEventId =
  "conversationUpdate" | "apiCall" | "stateChange";


export type AgentBeforeEventId = `before:${AgentDefaultEventId}`;

export type AgentAfterEventId = `after:${AgentDefaultEventId}`;

export type AgentEventId = AgentDefaultEventId | AgentBeforeEventId | AgentAfterEventId;

export type EventDefaultCallback<TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    state: AgentState,
    getStore: () => Store<TStore> | undefined,
    getGlobalStore: () => Store<TGlobalStore> | undefined
) => maybePromise<void>;