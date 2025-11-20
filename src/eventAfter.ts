import type { maybePromise, StoreLike } from "./types";
import type { AgentAfterEventId, EventDefaultCallback } from "./event";
import type { AgentContext } from "@src/agentContext";
import type { DefineMetaData } from "./fragola";

export type messagesAddReason = "userMessage" | "toolCall" | "partialAiMessage" | "AiMessage";
export type messagesRemoveReason = `remove:${messagesAddReason}`;
export type messagesUpdateReason = messagesAddReason | messagesRemoveReason;

/**
 * Callback type for handling logic after a messages update event.
 *
 * @template TGlobalStore - The type of the global store.
 * @template TStore - The type of the local store.
 */
export type EventAfterMessagesUpdate<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    reason: messagesUpdateReason,
      context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<void>; 

export type AfterStateUpdateCallback<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = EventDefaultCallback<TMetaData, TGlobalStore, TStore>;

//@prettier-ignore
export type callbackMap<TMetaData extends DefineMetaData<any>,TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
    [K in AgentAfterEventId]:
        K extends "after:messagesUpdate" ? EventAfterMessagesUpdate<TMetaData, TGlobalStore, TStore> :
        K extends "after:stateUpdate" ? AfterStateUpdateCallback<TMetaData, TGlobalStore, TStore> :
        never;
};