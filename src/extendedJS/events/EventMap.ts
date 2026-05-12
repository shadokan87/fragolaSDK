import type { AgentDefaultEventId, AgentEventId } from "../../event";
import type {AgentAfterEventId} from "../../eventAfter";
import type {AgentBeforeEventId} from "../../eventBefore";
import { type callbackMap as eventDefaultCallbackMap } from "../../eventDefault";
import { type callbackMap as eventAfterCallbackMap } from "../../eventAfter";
import { type callbackMap as eventBeforeCallbackMap } from "../../eventBefore";
import type { DefineMetaData } from "../../fragola";
import type { ContextLike } from "../../types";

/**
 * Maps an event ID to its corresponding callback type based on the event category.
 *
 * - For default event IDs (`AgentDefaultEventId`), returns the callback type from `eventDefaultCallbackMap`.
 * - For other event IDs, resolves to `never`.
 *
 * @template TEventId - The type of the event ID.
 * @template TGlobalContext - The type of the global context.
 * @template TContext - The type of the local context.
 */
export type eventIdToCallback<TEventId extends AgentEventId, TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any>, TContext extends ContextLike<any>> =
    TEventId extends AgentDefaultEventId ? eventDefaultCallbackMap<TMetaData, TGlobalContext, TContext>[TEventId] :
    TEventId extends AgentAfterEventId ? eventAfterCallbackMap<TMetaData, TGlobalContext, TContext>[TEventId] :
    TEventId extends AgentBeforeEventId ? eventBeforeCallbackMap<TMetaData, TGlobalContext, TContext>[TEventId] :
    never;

export type registeredEvent<TEventId extends AgentEventId, TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any>, TContext extends ContextLike<any>> = {
    id: string,
    callback: eventIdToCallback<TEventId, TMetaData, TGlobalContext, TContext>,
    sourceHookId?: string
}

export class EventMap<
    K extends AgentEventId, V extends registeredEvent<K, TMetaData, TGlobalContext, TContext>[],
    TMetaData extends DefineMetaData<any>,
    TGlobalContext extends ContextLike<any> = {},
    TContext extends ContextLike<any> = {}>
    extends globalThis.Map<K, V> {
        // @ts-ignore - intentionally overrides with a different return type than Map<K, V>.get
        get<TKey extends K>(key: TKey): registeredEvent<TKey, TMetaData, TGlobalContext, TContext>[] | undefined {
            return super.get(key) as unknown as registeredEvent<TKey, TMetaData, TGlobalContext, TContext>[] | undefined;
        }
        // get<TEventId extends AgentEventId>(key: TEventId): registeredEvent<TEventId, TMetaData, TGlobalContext, TContext> | undefined {
        //     const v  = super.get(key as any);
        //     return v as unknown as registeredEvent<TEventId, TMetaData, TGlobalContext, TContext> | undefined ;
        // }
    }