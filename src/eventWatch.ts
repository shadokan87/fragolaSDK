import type { EventDefaultCallback, EventDefaultCallbackPayload } from "./event";
import type { DefineMetaData } from "./fragola";
import type { StoreLike } from "./types";

export type AgentEventWatchId = "state";

export type EventWatchStatePayload = EventDefaultCallbackPayload;

export type EventWatchState<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = EventDefaultCallback<TMetaData, TGlobalStore, TStore>;

export type callbackMap<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
    [K in AgentEventWatchId]:
        K extends "state" ? EventWatchState<TMetaData, TGlobalStore, TStore> :
        never;
};