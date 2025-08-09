import type { AgentContext } from "./agent";
import type { maybePromise, StoreLike } from "./types";
import type { AgentAfterEventId, EventDefaultCallback } from "./event";

/**
 * Callback type for handling logic after a conversation update event.
 *
 * @template TGlobalStore - The type of the global store.
 * @template TStore - The type of the local store.
 */
export type AfterConversationUpdateCallback<TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    context: AgentContext
) => maybePromise<void>;

export type AfterStateUpdateCallback<TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    context: AgentContext
) => maybePromise<void>;

//@prettier-ignore
export type callbackMap<TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
    [K in AgentAfterEventId]:
        K extends "after:conversationUpdate" ? AfterConversationUpdateCallback<TGlobalStore, TStore> :
        K extends "after:stateUpdate" ? AfterStateUpdateCallback<TGlobalStore, TStore> :
        never;
};