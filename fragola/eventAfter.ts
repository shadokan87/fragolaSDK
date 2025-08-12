import type { maybePromise, StoreLike } from "./types";
import type { AgentAfterEventId, EventDefaultCallback } from "./event";
import type { AgentContext } from "./agent";

export type conversationUpdateReason = "userMessage" | "toolCall" | "partialAiMessage" | "AiMessage";

/**
 * Callback type for handling logic after a conversation update event.
 *
 * @template TGlobalStore - The type of the global store.
 * @template TStore - The type of the local store.
 */
export type AfterConversationUpdateCallback<TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    reason: conversationUpdateReason,
      context: AgentContext<TGlobalStore, TStore>
) => maybePromise<void>; 

export type AfterStateUpdateCallback<TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = EventDefaultCallback<TGlobalStore, TStore>;

//@prettier-ignore
export type callbackMap<TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
    [K in AgentAfterEventId]:
        K extends "after:conversationUpdate" ? AfterConversationUpdateCallback<TGlobalStore, TStore> :
        K extends "after:stateUpdate" ? AfterStateUpdateCallback<TGlobalStore, TStore> :
        never;
};