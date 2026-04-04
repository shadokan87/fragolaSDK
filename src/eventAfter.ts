import type { maybePromise, StoreLike } from "./types";
import type { AgentDefaultEventId, EventDefaultCallback } from "./event";
import type { AgentContext } from "@src/agentContext";
import type { ChatCompletionAssistantMessageParam, ChatCompletionMessageParam, DefineMetaData, Tool, ToolHandlerReturnTypeNonAsync } from "./fragola";
import type { StepOptions } from "./agent";

export type AgentAfterEventExclusive = "after:stateUpdate";

export type AgentAfterEventId = `after:${AgentDefaultEventId}` | AgentAfterEventExclusive;

export type EventAfterStateUpdate<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = EventDefaultCallback<TMetaData, TGlobalStore, TStore>;

export type EventAfterStep<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    options: Required<StepOptions>,
    newMessages: ChatCompletionMessageParam<TMetaData>[],
    stepsTaken: number,
    context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<void>;

export type EventAfterModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    message: ChatCompletionAssistantMessageParam<TMetaData>,
    context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<void>;

export type EventAfterToolCall<TParams = Record<any, any>, TMetaData extends DefineMetaData<any> = {}, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> = (
    result: ToolHandlerReturnTypeNonAsync,
    params: TParams,
    tool: Tool<any>,
    context: AgentContext<TMetaData, TGlobalStore, TStore>
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
