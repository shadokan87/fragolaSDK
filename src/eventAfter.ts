import type { maybePromise, StoreLike } from "./types";
import type { AgentDefaultEventId, EventDefaultCallback, EventDefaultCallbackPayload, EventPayloadBase, eventResult } from "./event";
import type { AgentContext } from "@src/agentContext";
import type { ChatCompletionAssistantMessageParam, ChatCompletionMessageParam, DefineMetaData, Tool } from "./fragola";
import type { ToolCallPayload } from "./eventDefault";
import type { StepOptions } from "./agent";

export type AgentAfterEventId = "after:modelInvocation" | "after:toolCall" | "after:aiMessage" | "after:step";

export type EventAfterStepPayload<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = EventPayloadBase<TMetaData, TGlobalStore, TStore> & {
    options: Required<StepOptions>;
    newMessages: ChatCompletionMessageParam<TMetaData>[];
    stepsTaken: number;
    error: any | undefined;
};

export type EventAfterStep<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    payload: EventAfterStepPayload<TMetaData, TGlobalStore, TStore>
) => maybePromise<eventResult<void>>;

export type EventAfterModelInvocationPayload<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = EventPayloadBase<TMetaData, TGlobalStore, TStore> & {
    message: ChatCompletionAssistantMessageParam<TMetaData>;
};

export type EventAfterModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    payload: EventAfterModelInvocationPayload<TMetaData, TGlobalStore, TStore>
) => maybePromise<eventResult<void>>;

export type EventAfterToolCallPayload<TMetaData extends DefineMetaData<any> = {}, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> = EventPayloadBase<TMetaData, TGlobalStore, TStore> & {
    toolCall: { readonly name: string, readonly id: string };
    result: ToolCallPayload;
    params: Record<string, any>;
    tool: Tool<any> | undefined;
};

export type EventAfterToolCall<TMetaData extends DefineMetaData<any> = {}, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> = (
    payload: EventAfterToolCallPayload<TMetaData, TGlobalStore, TStore>
) => maybePromise<eventResult<void>>;

//@prettier-ignore
export type callbackMap<TMetaData extends DefineMetaData<any>,TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
    [K in AgentAfterEventId]:
        K extends "after:step" ? EventAfterStep<TMetaData, TGlobalStore, TStore> :
        K extends "after:modelInvocation" ? EventAfterModelInvocation<TMetaData, TGlobalStore, TStore> :
        K extends "after:toolCall" ? EventAfterToolCall<TMetaData, TGlobalStore, TStore> :
        never;
};
