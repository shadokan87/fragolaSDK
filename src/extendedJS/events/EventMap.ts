import type { AgentAfterEventId, AgentDefaultEventId, AgentEventId } from "../../event";
import { type callbackMap as eventDefaultCallbackMap } from "../../eventDefault";
import { type callbackMap as eventAfterCallbackMap } from "../../eventAfter";
import type { DefineMetaData } from "../../fragola";
import type { StoreLike } from "../../types";
import { createHandleAiMessage, defaultHandleAiMessage, type HandleAiMessage } from "./aiMessage";
import { createHandleUserMessage, type HandleUserMessage } from "./userMessage";
import {AgentContext} from "@src/agentContext";

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
    extends globalThis.Map<K, V> {

    #handleAiMessage: HandleAiMessage = defaultHandleAiMessage;
    #handleUserMessage: HandleUserMessage | undefined = undefined;
    constructor(private getContext: () => AgentContext<TMetaData, TGlobalStore, TStore>, ...args: ConstructorParameters<typeof Map<K, V>>) {
        super(...args);
    }

    get handleAiMessage() {
        return this.#handleAiMessage;
    }

    get handleUserMessage() {
        return this.#handleUserMessage;
    }

    set(key: K, value: V): this {
        super.set(key, value);
        switch (key) {
            case "aiMessage": {
                this.#handleAiMessage = createHandleAiMessage(value as registeredEvent<"aiMessage", TMetaData, TGlobalStore, TStore>[], this.getContext as unknown as () => AgentContext<any>);
                break;
            }
            case "userMessage": {
                this.#handleUserMessage = createHandleUserMessage(value as registeredEvent<"userMessage", TMetaData, TGlobalStore, TStore>[], this.getContext as unknown as () => AgentContext<any>)
                break ;
            }
            default: {
                break;
            }
        }
        return this;
    }

    delete(key: K): boolean {
        const res = super.delete(key);
        if (res) {
            switch (key) {
                case "aiMessage": {
                    this.#handleAiMessage = defaultHandleAiMessage;
                    break;
                } case "userMessage": {
                    this.#handleUserMessage = undefined;
                    break ;
                }
                default: {
                    break;
                }
            }
        }
        return res;
    }
}