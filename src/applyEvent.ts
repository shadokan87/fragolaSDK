import { skip, SKIP_EVENT, stop } from "./event"
import type { EventAfterStateUpdate, EventAfterStep, EventAfterModelInvocation, EventAfterToolCall } from "./eventAfter"
import type { EventBeforeStep, EventBeforeModelInvocation, EventBeforeToolCall, ModelInvocationConfig } from "./eventBefore"
import type { EventAiMessage, EventModelInvocation, EventToolCall, EventUserMessage } from "./eventDefault"
import type { registeredEvent } from "./extendedJS/events/EventMap"
import type { ChatCompletionAssistantMessageParam, ChatCompletionUserMessageParam, DefineMetaData, ToolHandlerReturnTypeNonAsync } from "./fragola"
import type { maybePromise, StoreLike } from "./types"
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

export async function applyAfterStateUpdate<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"after:stateUpdate", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    accumulate?: AccumulateCallback<ReturnType<EventAfterStateUpdate<TMetaData, TGlobalStore, TStore>>>
) {
    let result: ApplyEventResult<EventAfterStateUpdate<TMetaData, TGlobalStore, TStore>> = {
        signal: undefined,
        value: undefined
    }
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventAfterStateUpdate<TMetaData, TGlobalStore, TStore>;
        const params: Parameters<typeof callback> = [context];

        const res = await callback(...params) as any;
        if (accumulate)
            await accumulate(res);
        if (isStopEvent(res)) {
            result.signal = res;
            break;
        }
    }
    return result;
}

export async function applyBeforeStep<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"before:step", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"before:step", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventBeforeStep<TMetaData, TGlobalStore, TStore>>>
) {
    let stopSignal: any;
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventBeforeStep<TMetaData, TGlobalStore, TStore>;
        const params: Parameters<typeof callback> = [_params.options, context];
        const res = await callback(...params) as any;
        if (accumulate)
            await accumulate(res);
        if (isStopEvent(res)) {
            stopSignal = res;
            break;
        }
    }
    return stopSignal;
}

export async function applyAfterStep<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"after:step", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"after:step", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventAfterStep<TMetaData, TGlobalStore, TStore>>>
) {
    let stopSignal: any;
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventAfterStep<TMetaData, TGlobalStore, TStore>;
        const params: Parameters<typeof callback> = [_params.options, _params.newMessages, _params.stepsTaken, context];
        const res = await callback(...params) as any;
        if (accumulate)
            await accumulate(res);
        if (isStopEvent(res)) {
            stopSignal = res;
            break;
        }
    }
    return stopSignal;
}

export async function applyBeforeModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"before:modelInvocation", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"before:modelInvocation", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventBeforeModelInvocation<TMetaData, TGlobalStore, TStore>>>
) {
    let { config } = _params;
    let configTmp: ModelInvocationConfig<TMetaData>;
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventBeforeModelInvocation<TMetaData, TGlobalStore, TStore>;
        const params: Parameters<typeof callback> = [config, context];
        configTmp = await callback(...params) as any;
        if (accumulate)
            await accumulate(configTmp);
        if (isStopEvent(configTmp))
            return configTmp;
        if (!isSkipEvent(configTmp))
            config = configTmp;
    }
    return config;
}

export async function applyModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"modelInvocation", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"modelInvocation", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventModelInvocation<TMetaData, TGlobalStore, TStore>>>
) {
    for (let i = 0; i < events.length; i++) {
        const {callback} = events[i];
        const res = await callback(_params.kind, _params.data, context);
        if (accumulate)
            await accumulate(res);
        if (isStopEvent(res))
            return res;
        if (isSkipEvent(res))
            continue ;
        _params.data = res as any;
    }
    return _params.data;
}

export async function applyAfterModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"after:modelInvocation", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"after:modelInvocation", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventAfterModelInvocation<TMetaData, TGlobalStore, TStore>>>
) {
    let stopSignal: any;
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventAfterModelInvocation<TMetaData, TGlobalStore, TStore>;
        const params: Parameters<typeof callback> = [_params.message, context];
        const res = await callback(...params) as any;
        if (accumulate)
            await accumulate(res);
        if (isStopEvent(res)) {
            stopSignal = res;
            break;
        }
    }
    return stopSignal;
}

export async function applyAiMessage<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"aiMessage", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"aiMessage", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventAiMessage<TMetaData, TGlobalStore, TStore>>>
) {
    let message = _params.message;
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventAiMessage<TMetaData, TGlobalStore, TStore>;
        const params: Parameters<typeof callback> = [message, _params.isPartial, context];
        const res = await callback(...params) as any;
        if (accumulate)
            await accumulate(res);
        if (isStopEvent(res))
            return res;
        if (isSkipEvent(res))
            continue;
        message = res as ChatCompletionAssistantMessageParam<TMetaData>;
    }
    return message;
}

export async function applyUserMessage<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"userMessage", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"userMessage", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventUserMessage<TMetaData, TGlobalStore, TStore>>>
) {
    let message = _params.message;
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventUserMessage<TMetaData, TGlobalStore, TStore>;
        const params: Parameters<typeof callback> = [{ role: "user", ...message } as ChatCompletionUserMessageParam<TMetaData>, context];
        const res = await callback(...params) as any;
        if (accumulate)
            await accumulate(res);
        if (isStopEvent(res))
            return res;
        if (isSkipEvent(res))
            continue;
        const { role, ...nextMessage } = res as ChatCompletionUserMessageParam<TMetaData>;
        void role;
        message = nextMessage as typeof message;
    }
    return message;
}

export async function applyBeforeToolCall<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"before:toolCall", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"before:toolCall", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventBeforeToolCall<any, TMetaData, TGlobalStore, TStore>>>
) {
    let stopSignal: any;
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventBeforeToolCall<any, TMetaData, TGlobalStore, TStore>;
        const params: Parameters<typeof callback> = [_params.params, _params.tool, context];
        const res = await callback(...params) as any;
        if (accumulate)
            await accumulate(res);
        if (isStopEvent(res)) {
            stopSignal = res;
            break;
        }
    }
    return stopSignal;
}

export async function applyToolCall<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"toolCall", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"toolCall", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventToolCall<any, TMetaData, TGlobalStore, TStore>>>
) {
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventToolCall<any, TMetaData, TGlobalStore, TStore>;
        const params: Parameters<typeof callback> = [_params.params, _params.tool, context];
        const res = await callback(...params) as any;
        if (accumulate)
            await accumulate(res);
        if (isStopEvent(res))
            return res;
        if (isSkipEvent(res))
            continue;
        return res as ToolHandlerReturnTypeNonAsync;
    }
    return skip();
}

export async function applyAfterToolCall<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"after:toolCall", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"after:toolCall", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventAfterToolCall<any, TMetaData, TGlobalStore, TStore>>>
) {
    let stopSignal: any;
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventAfterToolCall<any, TMetaData, TGlobalStore, TStore>;
        const params: Parameters<typeof callback> = [_params.result, _params.params, _params.tool, context];
        const res = await callback(...params) as any;
        if (accumulate)
            await accumulate(res);
        if (isStopEvent(res)) {
            stopSignal = res;
            break;
        }
    }
    return stopSignal;
}
