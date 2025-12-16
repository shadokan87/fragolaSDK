import type { AgentDefaultEventId } from "./event";
import type { maybePromise, StoreLike } from "./types";
import type { AgentContext } from "@src/agentContext";
import type { DefineMetaData, Tool } from "./fragola";
import type { StepOptions } from "./agent";

export type AgentBeforeEventId = `before:${AgentDefaultEventId}`;

export type EventBeforeStep<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    options: Required<StepOptions>,
    context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<void>;

export type EventBeforeModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<void>;

export type EventBeforeToolCall<TParams = Record<any, any>, TMetaData extends DefineMetaData<any> = {}, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> = (
    params: TParams,
    tool: Tool<any>,
    context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<void>;

//@prettier-ignore
export type callbackMap<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
    [K in AgentBeforeEventId]:
    K extends "before:step" ? EventBeforeStep<TMetaData, TGlobalStore, TStore> :
    K extends "before:modelInvocation" ? EventBeforeModelInvocation<TMetaData, TGlobalStore, TStore> :
    K extends "before:toolCall" ? EventBeforeToolCall<any, TMetaData, TGlobalStore, TStore> :
    never;
};
