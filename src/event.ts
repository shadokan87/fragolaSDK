import type { AgentContext } from "@src/agentContext";
import { STOP } from "./agentContext";
import type { StoreLike, maybePromise } from "./types";
import type { DefineMetaData } from "./fragola";
import type { AgentAfterEventId } from "./eventAfter";
import type { AgentBeforeEventId } from "./eventBefore";
import type { AgentEventWatchId } from "./eventWatch";

export type AgentDefaultEventId =
   "modelInvocation" | "toolCall" | "aiMessage" | "userMessage";


export const stop = () => ({[STOP]: true});

export type eventResult<T> = T | ReturnType<typeof stop>; //TODO: fix stop not imported

export type AgentOnEventId = AgentDefaultEventId | AgentAfterEventId | AgentBeforeEventId;

export type AgentEventId = AgentOnEventId | AgentEventWatchId;

export type {
    ToolCallPayload
} from "./eventDefault";

export type EventPayloadBase<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
  context: AgentContext<TMetaData, TGlobalStore, TStore>;
};

export type EventDefaultCallbackPayload<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = EventPayloadBase<TMetaData, TGlobalStore, TStore>;

export type EventDefaultCallback<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
  payload: EventDefaultCallbackPayload<TMetaData, TGlobalStore, TStore>
) => maybePromise<void>;