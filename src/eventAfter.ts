import type { maybePromise, StoreLike } from "./types";
import type { AgentDefaultEventId, EventDefaultCallback, EventDefaultCallbackPayload, EventPayloadBase } from "./event";
import type { AgentContext } from "@src/agentContext";
import type { ChatCompletionAssistantMessageParam, ChatCompletionMessageParam, DefineMetaData, Tool } from "./fragola";
import type { ToolCallPayload } from "./eventDefault";
import type { StepOptions } from "./agent";

export type AgentAfterEventExclusive = "after:stateUpdate" | "after:step";

export type AgentAfterEventId = `after:${AgentDefaultEventId}` | AgentAfterEventExclusive;

export type EventAfterStateUpdatePayload<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = EventDefaultCallbackPayload<TMetaData, TGlobalStore, TStore>;

export type EventAfterStateUpdate<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = EventDefaultCallback<TMetaData, TGlobalStore, TStore>;

export type EventAfterStepPayload<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = EventPayloadBase<TMetaData, TGlobalStore, TStore> & {
    options: Required<StepOptions>;
    newMessages: ChatCompletionMessageParam<TMetaData>[];
    stepsTaken: number;
    error: any | undefined;
};

export type EventAfterStep<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    payload: EventAfterStepPayload<TMetaData, TGlobalStore, TStore>
) => maybePromise<void>;

export type EventAfterModelInvocationPayload<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = EventPayloadBase<TMetaData, TGlobalStore, TStore> & {
    message: ChatCompletionAssistantMessageParam<TMetaData>;
};

export type EventAfterModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    payload: EventAfterModelInvocationPayload<TMetaData, TGlobalStore, TStore>
) => maybePromise<void>;

export type EventAfterToolCallPayload<TParams = Record<any, any>, TMetaData extends DefineMetaData<any> = {}, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> = EventPayloadBase<TMetaData, TGlobalStore, TStore> & {
    toolCall: { readonly name: string, readonly id: string };
    result: ToolCallPayload;
    params: TParams;
    tool: Tool<any> | undefined;
};

export type EventAfterToolCall<TParams = Record<any, any>, TMetaData extends DefineMetaData<any> = {}, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> = (
    payload: EventAfterToolCallPayload<TParams, TMetaData, TGlobalStore, TStore>
) => maybePromise<void>;

//@prettier-ignore
export type callbackMap<TMetaData extends DefineMetaData<any>,TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
    [K in AgentAfterEventId]:
        K extends "after:stateUpdate" ? EventAfterStateUpdate<TMetaData, TGlobalStore, TStore> :
        K extends "after:step" ? EventAfterStep<TMetaData, TGlobalStore, TStore> :
        K extends "after:modelInvocation" ? EventAfterModelInvocation<TMetaData, TGlobalStore, TStore> :
        K extends "after:toolCall" ? EventAfterToolCall<any, TMetaData, TGlobalStore, TStore> :
        never;
};
