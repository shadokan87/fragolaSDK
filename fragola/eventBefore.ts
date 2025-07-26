import type { StoreLike } from "./types";
import type { AgentBeforeEventId, AgentDefaultEventId, EventDefaultCallback } from "./event";

/**
 * Callback type for handling logic before a conversation update event.
 *
 * @template TGlobalStore - The type of the global store.
 * @template TStore - The type of the local store.
 */
export type BeforeConversationUpdateCallback<TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = EventDefaultCallback<TGlobalStore, TStore>;

export type callbackMap<TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
    [K in AgentBeforeEventId]:
        K extends "before:conversationUpdate" ? BeforeConversationUpdateCallback<TGlobalStore, TStore> :
        never;
};