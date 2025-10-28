import type { maybePromise, StoreLike } from "./types";
import type { AgentAfterEventId, EventDefaultCallback } from "./event";
import type { AgentContext } from "./agent";
import type { DefineMetaData } from "./fragola";

export type conversationAddReason = "userMessage" | "toolCall" | "partialAiMessage" | "AiMessage";
export type conversationRemoveReason = `remove:${conversationAddReason}`;
export type conversationUpdateReason = conversationAddReason | conversationRemoveReason;

/**
 * Callback type for handling logic after a conversation update event.
 *
 * @template TGlobalStore - The type of the global store.
 * @template TStore - The type of the local store.
 */
export type EventAfterConversationUpdate<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    reason: conversationUpdateReason,
      context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<void>; 

export type AfterStateUpdateCallback<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = EventDefaultCallback<TMetaData, TGlobalStore, TStore>;

//@prettier-ignore
export type callbackMap<TMetaData extends DefineMetaData<any>,TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
    [K in AgentAfterEventId]:
        K extends "after:conversationUpdate" ? EventAfterConversationUpdate<TMetaData, TGlobalStore, TStore> :
        K extends "after:stateUpdate" ? AfterStateUpdateCallback<TMetaData, TGlobalStore, TStore> :
        never;
};