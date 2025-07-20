import type OpenAI from "openai/index.js";
import type { AgentState } from "./agent";
import type {  maybePromise } from "./types";
import type { AgentDefaultEventId } from "./event";

/**
 * Callback for the "conversationUpdate" agent event.
 * @param newConversation - The updated conversation messages.
 * @param state - The current agent state.
 * @returns The possibly updated conversation messages (can be a Promise).
 */
export type ConversationUpdateCallback = (
    newConversation: OpenAI.ChatCompletionMessageParam[],
    state: AgentState
) => maybePromise<OpenAI.ChatCompletionMessageParam[]>;

//@prettier-ignore
export type callbackMap = {
    [K in AgentDefaultEventId]:
    K extends "conversationUpdate" ? ConversationUpdateCallback :
    never;
};
