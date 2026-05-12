import type { maybePromise, ContextLike } from "./types";
import type { AgentDefaultEventId, EventDefaultCallback } from "./event";
import type { AgentContext } from "@src/agentContext";
import type { ChatCompletionAssistantMessageParam, ChatCompletionMessageParam, DefineMetaData, Tool, ToolHandlerReturnTypeNonAsync } from "./fragola";
import type { StepOptions } from "./agent";

export type AgentAfterEventExclusive = "after:stateUpdate" | "after:step";

export type AgentAfterEventId = `after:${AgentDefaultEventId}` | AgentAfterEventExclusive;

export type EventAfterStateUpdate<TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any>, TContext extends ContextLike<any>> = EventDefaultCallback<TMetaData, TGlobalContext, TContext>;

export type EventAfterStep<TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any>, TContext extends ContextLike<any>> = (
    options: Required<StepOptions>,
    newMessages: ChatCompletionMessageParam<TMetaData>[],
    stepsTaken: number,
    context: AgentContext<TMetaData, TGlobalContext, TContext>
) => maybePromise<void>;

export type EventAfterModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any>, TContext extends ContextLike<any>> = (
    message: ChatCompletionAssistantMessageParam<TMetaData>,
    context: AgentContext<TMetaData, TGlobalContext, TContext>
) => maybePromise<void>;

export type EventAfterToolCall<TParams = Record<any, any>, TMetaData extends DefineMetaData<any> = {}, TGlobalContext extends ContextLike<any> = {}, TContext extends ContextLike<any> = {}> = (
    result: ToolHandlerReturnTypeNonAsync,
    params: TParams,
    tool: Tool<any>,
    context: AgentContext<TMetaData, TGlobalContext, TContext>
) => maybePromise<void>;

//@prettier-ignore
export type callbackMap<TMetaData extends DefineMetaData<any>,TGlobalContext extends ContextLike<any>, TContext extends ContextLike<any>> = {
    [K in AgentAfterEventId]:
        K extends "after:stateUpdate" ? EventAfterStateUpdate<TMetaData, TGlobalContext, TContext> :
        K extends "after:step" ? EventAfterStep<TMetaData, TGlobalContext, TContext> :
        K extends "after:modelInvocation" ? EventAfterModelInvocation<TMetaData, TGlobalContext, TContext> :
        K extends "after:toolCall" ? EventAfterToolCall<any, TMetaData, TGlobalContext, TContext> :
        never;
};
