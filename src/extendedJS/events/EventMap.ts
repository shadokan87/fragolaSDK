import type { AgentDefaultEventId, AgentEventId } from "../../event";
import type {AgentAfterEventId} from "../../eventAfter";
import type {AgentBeforeEventId} from "../../eventBefore";
import { type callbackMap as eventDefaultCallbackMap } from "../../eventDefault";
import { type callbackMap as eventAfterCallbackMap } from "../../eventAfter";
import { type callbackMap as eventBeforeCallbackMap } from "../../eventBefore";
import type { DefineMetaData } from "../../fragola";
import type { StoreLike } from "../../types";

/**
 * Maps an event ID to its corresponding callback type based on the event category.
 *
 * - For default event IDs (`AgentDefaultEventId`), returns the callback type from `eventDefaultCallbackMap`.
 * - For other event IDs, resolves to `never`.
 *
 * @template TEventId - The type of the event ID.
 * @template TGlobalStore - The type of the global store.
 * @template TStore - The type of the local store.
 */
export type eventIdToCallback<TEventId extends AgentEventId, TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> =
    TEventId extends AgentDefaultEventId ? eventDefaultCallbackMap<TMetaData, TGlobalStore, TStore>[TEventId] :
    TEventId extends AgentAfterEventId ? eventAfterCallbackMap<TMetaData, TGlobalStore, TStore>[TEventId] :
    TEventId extends AgentBeforeEventId ? eventBeforeCallbackMap<TMetaData, TGlobalStore, TStore>[TEventId] :
    never;

export type registeredEvent<TEventId extends AgentEventId, TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
    id: string,
    callback: eventIdToCallback<TEventId, TMetaData, TGlobalStore, TStore>
}

export class EventMap<
    K extends AgentEventId, V extends registeredEvent<AgentEventId, TMetaData, TGlobalStore, TStore>[],
    TMetaData extends DefineMetaData<any>,
    TGlobalStore extends StoreLike<any> = {},
    TStore extends StoreLike<any> = {}>
    extends globalThis.Map<K, V> {}