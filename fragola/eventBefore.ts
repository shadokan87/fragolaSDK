import type { AgentState } from "./agent";
import type { maybePromise, StoreLike } from "./types";
import type { AgentBeforeEventId, AgentDefaultEventId } from "./event";
import type { GetStore } from "./fragola";
import type { Store } from "./store";

/**
 * Callback invoked before the "conversationUpdate" event is processed by the agent.
 * Allows inspection of the agent state prior to updating the conversation.
 *
 * @param state - The current state of the agent.
 */
export type BeforeConversationUpdateCallback<TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    state: AgentState,
    getStore: () => Store<TStore>,
    getGlobalStore: () => Store<TGlobalStore>
) => maybePromise<void>;

export type callbackMap<TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
    [K in AgentBeforeEventId]:
        K extends "before:conversationUpdate" ? BeforeConversationUpdateCallback<TGlobalStore, TStore> :
        never;
};