import type OpenAI from "openai/index.js";
import { skip, SKIP_EVENT, stop } from "./event"
import type { EventAfterStateUpdate, EventAfterStep, EventAfterModelInvocation, EventAfterToolCall } from "./eventAfter"
import type { EventBeforeStep, EventBeforeModelInvocation, EventBeforeToolCall, ModelInvocationConfig, ToolCallConfig } from "./eventBefore"
import type { EventAiMessage, EventModelInvocation, EventToolCall, EventUserMessage } from "./eventDefault"
import type { registeredEvent } from "./extendedJS/events/EventMap"
import type { ChatCompletionAssistantMessageParam, ChatCompletionUserMessageParam, DefineMetaData, ToolHandlerReturnTypeNonAsync } from "./fragola"
import type { maybePromise, ContextLike } from "./types"
import type { AgentContext, STOP } from "./agentContext"
import { type applyEventParams } from "./agent"
import { isSkipEvent, isStopEvent } from "./utils";

export type AccumulateCallback<T> = (data: Awaited<T>) => maybePromise<void>;
export type EventResult<T extends (...args: any) => any> = Awaited<ReturnType<T>>;

export type ExcludeSignal<T> = Exclude<T, { [SKIP_EVENT]: boolean } | { [STOP]: boolean }>;

export type EventStripSignal<T extends (...args: any[]) => any> = ExcludeSignal<Awaited<
ReturnType<T>
>>;

/**
* Will return the last accumulated value and last known signal (skip/stop)
*/
export type ApplyEventResult<T extends (...args: any[]) => any> = {
    signal: ReturnType<typeof skip> | ReturnType<typeof stop> | undefined,
    value: EventStripSignal<T>
}

export async function applyAfterStateUpdate<TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any>, TContext extends ContextLike<any>>(
    events: registeredEvent<"after:stateUpdate", TMetaData, TGlobalContext, TContext>[],
    context: AgentContext<TMetaData, TGlobalContext, TContext>,
    accumulate?: AccumulateCallback<ReturnType<EventAfterStateUpdate<TMetaData, TGlobalContext, TContext>>>
) {
    let result: ApplyEventResult<EventAfterStateUpdate<TMetaData, TGlobalContext, TContext>> = {
        signal: undefined,
        value: undefined
    }
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventAfterStateUpdate<TMetaData, TGlobalContext, TContext>;
        const params: Parameters<typeof callback> = [context];

        const res = await callback(...params) as any;
        if (accumulate)
            await accumulate(res);
        if (isStopEvent(res)) {
            result.signal = res;
            break;
        }
        if (isSkipEvent(res)) {
            result.signal = res;
            continue;
        }
        result.value = res;
    }
    return result;
}

export async function applyBeforeStep<TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any>, TContext extends ContextLike<any>>(
    events: registeredEvent<"before:step", TMetaData, TGlobalContext, TContext>[],
    context: AgentContext<TMetaData, TGlobalContext, TContext>,
    _params: applyEventParams<"before:step", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventBeforeStep<TMetaData, TGlobalContext, TContext>>>
) {
    let result: ApplyEventResult<EventBeforeStep<TMetaData, TGlobalContext, TContext>> = {
        signal: undefined,
        value: _params.options
    }
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventBeforeStep<TMetaData, TGlobalContext, TContext>;
        const params: Parameters<typeof callback> = [_params.options, context];
        const res = await callback(...params) as any;
        if (accumulate)
            await accumulate(res);
        if (isStopEvent(res)) {
            result.signal = res;
            break;
        }
        if (isSkipEvent(res)) {
            result.signal = res;
            continue;
        }
        result.value = res;
    }
    return result;
}

export async function applyAfterStep<TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any>, TContext extends ContextLike<any>>(
    events: registeredEvent<"after:step", TMetaData, TGlobalContext, TContext>[],
    context: AgentContext<TMetaData, TGlobalContext, TContext>,
    _params: applyEventParams<"after:step", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventAfterStep<TMetaData, TGlobalContext, TContext>>>
) {
    let result: ApplyEventResult<EventAfterStep<TMetaData, TGlobalContext, TContext>> = {
        signal: undefined,
        value: undefined
    }
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventAfterStep<TMetaData, TGlobalContext, TContext>;
        const params: Parameters<typeof callback> = [_params.options, _params.newMessages, _params.stepsTaken, context];
        const res = await callback(...params) as any;
        if (accumulate)
            await accumulate(res);
        if (isStopEvent(res)) {
            result.signal = res;
            break;
        }
        if (isSkipEvent(res)) {
            result.signal = res;
            continue;
        }
        result.value = res;
    }
    return result;
}

export async function applyBeforeModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any>, TContext extends ContextLike<any>>(
    events: registeredEvent<"before:modelInvocation", TMetaData, TGlobalContext, TContext>[],
    context: AgentContext<TMetaData, TGlobalContext, TContext>,
    _params: applyEventParams<"before:modelInvocation", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventBeforeModelInvocation<TMetaData, TGlobalContext, TContext>>>
) {
    let result: ApplyEventResult<EventBeforeModelInvocation<TMetaData, TGlobalContext, TContext>> = {
        signal: undefined,
        value: _params.config
    }
    let configTmp: ModelInvocationConfig<TMetaData>;
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventBeforeModelInvocation<TMetaData, TGlobalContext, TContext>;
        const params: Parameters<typeof callback> = [result.value, context];
        configTmp = await callback(...params) as any;
        if (accumulate)
            await accumulate(configTmp);
        if (isStopEvent(configTmp)) {
            result.signal = configTmp as any;
            return result;
        }
        if (isSkipEvent(configTmp)) {
            result.signal = configTmp as any;
            continue;
        }
        result.value = configTmp;
    }
    return result;
}

export async function applyModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any>, TContext extends ContextLike<any>>(
    events: registeredEvent<"modelInvocation", TMetaData, TGlobalContext, TContext>[],
    context: AgentContext<TMetaData, TGlobalContext, TContext>,
    _params: applyEventParams<"modelInvocation", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventModelInvocation<TMetaData, TGlobalContext, TContext>>>
) {
    let result: ApplyEventResult<EventModelInvocation<TMetaData, TGlobalContext, TContext>> = {
        signal: undefined,
        value: _params.data as any
    }
    for (let i = 0; i < events.length; i++) {
        const {callback} = events[i];
        const invocation = _params.kind === "chunk"
            ? { kind: "chunk" as const, data: result.value as OpenAI.ChatCompletionChunk }
            : { kind: "completion" as const, data: result.value as ChatCompletionAssistantMessageParam<TMetaData> };
        const res = await callback(invocation, context);
        if (accumulate)
            await accumulate(res);
        if (isStopEvent(res)) {
            result.signal = res as any;
            return result;
        }
        if (isSkipEvent(res)) {
            result.signal = res as any;
            continue;
        }
        result.value = res as any;
    }
    return result;
}

export async function applyAfterModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any>, TContext extends ContextLike<any>>(
    events: registeredEvent<"after:modelInvocation", TMetaData, TGlobalContext, TContext>[],
    context: AgentContext<TMetaData, TGlobalContext, TContext>,
    _params: applyEventParams<"after:modelInvocation", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventAfterModelInvocation<TMetaData, TGlobalContext, TContext>>>
) {
    let result: ApplyEventResult<EventAfterModelInvocation<TMetaData, TGlobalContext, TContext>> = {
        signal: undefined,
        value: undefined
    }
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventAfterModelInvocation<TMetaData, TGlobalContext, TContext>;
        const params: Parameters<typeof callback> = [_params.message, context];
        const res = await callback(...params) as any;
        if (accumulate)
            await accumulate(res);
        if (isStopEvent(res)) {
            result.signal = res;
            break;
        }
        if (isSkipEvent(res)) {
            result.signal = res;
            continue;
        }
        result.value = res;
    }
    return result;
}

export async function applyAiMessage<TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any>, TContext extends ContextLike<any>>(
    events: registeredEvent<"aiMessage", TMetaData, TGlobalContext, TContext>[],
    context: AgentContext<TMetaData, TGlobalContext, TContext>,
    _params: applyEventParams<"aiMessage", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventAiMessage<TMetaData, TGlobalContext, TContext>>>
) {
    let result: ApplyEventResult<EventAiMessage<TMetaData, TGlobalContext, TContext>> = {
        signal: undefined,
        value: _params.message
    }
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventAiMessage<TMetaData, TGlobalContext, TContext>;
        const params: Parameters<typeof callback> = [result.value as ChatCompletionAssistantMessageParam<TMetaData>, _params.finish_reason, _params.usage, context];
        const res = await callback(...params) as any;
        if (accumulate)
            await accumulate(res);
        if (isStopEvent(res)) {
            result.signal = res;
            return result;
        }
        if (isSkipEvent(res)) {
            result.signal = res;
            continue;
        }
        result.value = res as ChatCompletionAssistantMessageParam<TMetaData>;
    }
    return result;
}

export async function applyUserMessage<TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any>, TContext extends ContextLike<any>>(
    events: registeredEvent<"userMessage", TMetaData, TGlobalContext, TContext>[],
    context: AgentContext<TMetaData, TGlobalContext, TContext>,
    _params: applyEventParams<"userMessage", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventUserMessage<TMetaData, TGlobalContext, TContext>>>
) {
    let result: ApplyEventResult<EventUserMessage<TMetaData, TGlobalContext, TContext>> = {
        value: {role: "user", ..._params.message},
        signal: undefined
    }
    // let message = _params.message;
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventUserMessage<TMetaData, TGlobalContext, TContext>;
        const params: Parameters<typeof callback> = [result.value as ChatCompletionUserMessageParam<TMetaData>, context];
        const res = await callback(...params) as any;
        if (accumulate)
            await accumulate(res);
        if (isStopEvent(res)) {
            result.signal = res;
            return result;
        }
        if (isSkipEvent(res)) {
            result.signal = res;
            continue;
        }
        const { role, ...nextMessage } = res as ChatCompletionUserMessageParam<TMetaData>;
        void role;
        result.value = nextMessage as typeof result.value;
    }
    if (!result.value["role"])
        result.value["role"] = "user";
    return result;
}

export async function applyBeforeToolCall<TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any>, TContext extends ContextLike<any>>(
    events: registeredEvent<"before:toolCall", TMetaData, TGlobalContext, TContext>[],
    context: AgentContext<TMetaData, TGlobalContext, TContext>,
    _params: applyEventParams<"before:toolCall", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventBeforeToolCall<any, TMetaData, TGlobalContext, TContext>>>
) {
    let result: ApplyEventResult<EventBeforeToolCall<any, TMetaData, TGlobalContext, TContext>> = {
        signal: undefined,
        value: _params.config
    }
    let configTmp: ToolCallConfig<any>;
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventBeforeToolCall<any, TMetaData, TGlobalContext, TContext>;
        configTmp = await callback(result.value, _params.tool, context) as any;
        if (accumulate)
            await accumulate(configTmp);
        if (isStopEvent(configTmp)) {
            result.signal = configTmp as any;
            return result;
        }
        if (isSkipEvent(configTmp)) {
            result.signal = configTmp as any;
            continue;
        }
        result.value = configTmp;
    }
    return result;
}

export async function applyToolCall<TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any>, TContext extends ContextLike<any>>(
    events: registeredEvent<"toolCall", TMetaData, TGlobalContext, TContext>[],
    context: AgentContext<TMetaData, TGlobalContext, TContext>,
    _params: applyEventParams<"toolCall", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventToolCall<any, TMetaData, TGlobalContext, TContext>>>
) {
    let result: ApplyEventResult<EventToolCall<any, TMetaData, TGlobalContext, TContext>> = {
        signal: undefined,
        value: _params.result as any
    }
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventToolCall<any, TMetaData, TGlobalContext, TContext>;
        const res = await callback(result.value, _params.params, _params.tool, context) as any;
        if (accumulate)
            await accumulate(res);
        if (isStopEvent(res)) {
            result.signal = res as any;
            return result;
        }
        if (isSkipEvent(res)) {
            result.signal = res as any;
            continue;
        }
        result.value = res as ToolHandlerReturnTypeNonAsync;
    }
    return result;
}

export async function applyAfterToolCall<TMetaData extends DefineMetaData<any>, TGlobalContext extends ContextLike<any>, TContext extends ContextLike<any>>(
    events: registeredEvent<"after:toolCall", TMetaData, TGlobalContext, TContext>[],
    context: AgentContext<TMetaData, TGlobalContext, TContext>,
    _params: applyEventParams<"after:toolCall", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventAfterToolCall<any, TMetaData, TGlobalContext, TContext>>>
) {
    let result: ApplyEventResult<EventAfterToolCall<any, TMetaData, TGlobalContext, TContext>> = {
        signal: undefined,
        value: undefined
    }
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventAfterToolCall<any, TMetaData, TGlobalContext, TContext>;
        const params: Parameters<typeof callback> = [_params.result, _params.params, _params.tool, context];
        const res = await callback(...params) as any;
        if (accumulate)
            await accumulate(res);
        if (isStopEvent(res)) {
            result.signal = res;
            break;
        }
        if (isSkipEvent(res)) {
            result.signal = res;
            continue;
        }
        result.value = res;
    }
    return result;
}
