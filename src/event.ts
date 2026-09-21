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

export type eventResult<T> = T | ReturnType<typeof stop> | void; //TODO: fix stop not imported

export type AgentOnEventId = AgentDefaultEventId | AgentAfterEventId | AgentBeforeEventId;

export type AgentEventId = AgentOnEventId | AgentEventWatchId;

export type {
    ToolCallPayload
} from "./eventDefault";

export type EventPayloadBase = {};

export type EventDefaultCallbackPayload = EventPayloadBase;

export type EventDefaultCallback<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
  payload: EventDefaultCallbackPayload,
  context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<eventResult<void>>;