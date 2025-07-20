import type OpenAI from "openai/index.js";
import type { AgentState } from "./agent";
import type { maybePromise, StoreLike } from "./types";
import type { AgentDefaultEventId } from "./event";
import type { Store } from "./store";

/**
 * Callback for the "conversationUpdate" agent event.
 * @param newConversation - The updated conversation messages.
 * @param state - The current agent state.
 * @returns The possibly updated conversation messages (can be a Promise).
 */
export type ConversationUpdateCallback<TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    newConversation: OpenAI.ChatCompletionMessageParam[],
    state: AgentState,
    getStore: () => Store<TStore> | undefined,
    getGlobalStore: () => Store<TGlobalStore> | undefined
) => maybePromise<OpenAI.ChatCompletionMessageParam[]>;

//@prettier-ignore
export type callbackMap<TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
    [K in AgentDefaultEventId]:
    K extends "conversationUpdate" ? ConversationUpdateCallback<TGlobalStore, TStore> :
    never;
};
