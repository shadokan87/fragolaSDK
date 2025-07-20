import type OpenAI from "openai/index.js";

export type AgentDefaultEventId =
  "conversationUpdate" | "apiCall" | "stateChange";

export type AgentEventId = AgentDefaultEventId | AgentBeforeEventId | AgentAfterEventId;

export type AgentBeforeEventId = `before:${AgentDefaultEventId}`;

export type AgentAfterEventId = `after:${AgentDefaultEventId}`;