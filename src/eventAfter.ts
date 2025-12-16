import type { maybePromise, StoreLike } from "./types";
import type { AgentDefaultEventId, EventDefaultCallback } from "./event";
import type { AgentContext } from "@src/agentContext";
import type { ChatCompletionAssistantMessageParam, DefineMetaData, Tool, ToolHandlerReturnTypeNonAsync } from "./fragola";
import type { StepOptions } from "./agent";

export type AgentAfterEventExclusive = "after:stateUpdate";
export type AgentAfterEventId = `after:${AgentDefaultEventId}` | AgentAfterEventExclusive | "after:messagesUpdate";
export type messagesAddReason = "userMessage" | "toolCall" | "partialAiMessage" | "AiMessage";
export type messagesRemoveReason = `remove:${messagesAddReason}`;
export type messagesUpdateReason = messagesAddReason | messagesRemoveReason;

/**
 * Callback type for handling logic after a messages update event.
 *
 * @template TGlobalStore - The type of the global store.
 * @template TStore - The type of the local store.
 */
export type EventAfterMessagesUpdate<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    reason: messagesUpdateReason,
      context: AgentContext<TMetaData, TGlobalStore, TStore>
) => maybePromise<void>; 

export type AfterStateUpdateCallback<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = EventDefaultCallback<TMetaData, TGlobalStore, TStore>;

export type EventAfterStep<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    options: Required<StepOptions>,
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
        K extends "after:messagesUpdate" ? EventAfterMessagesUpdate<TMetaData, TGlobalStore, TStore> :
        K extends "after:stateUpdate" ? AfterStateUpdateCallback<TMetaData, TGlobalStore, TStore> :
        K extends "after:step" ? EventAfterStep<TMetaData, TGlobalStore, TStore> :
        K extends "after:modelInvocation" ? EventAfterModelInvocation<TMetaData, TGlobalStore, TStore> :
        K extends "after:toolCall" ? EventAfterToolCall<any, TMetaData, TGlobalStore, TStore> :
        never;
};
