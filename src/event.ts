import type { AgentContext } from "@src/agentContext";
import type { StoreLike, maybePromise } from "./types";
import type { DefineMetaData } from "./fragola";
import type { AgentAfterEventId } from "./eventAfter";
import type { AgentBeforeEventId } from "./eventBefore";

export type AgentDefaultEventId =
   "modelInvocation" | "toolCall" | "aiMessage" | "userMessage" | "step";

export const SKIP_EVENT = Symbol('skip_event');
/**
 * When returned from an event handler, the event will be ignored.
 * 
 * @returns An object with the SKIP_EVENT symbol that signals the event system to skip this event
 */
export const skip = () => ({[SKIP_EVENT]: true});

export type eventResult<T> = T | ReturnType<typeof skip> | ReturnType<typeof stop>;

export type AgentEventId = AgentDefaultEventId | AgentAfterEventId | AgentBeforeEventId;

export type EventDefaultCallback<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
  context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<void>;