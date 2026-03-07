import type { AgentEventId, EventDefaultCallback } from "./event"
import type { EventAfterMessagesUpdate, AfterStateUpdateCallback, EventAfterStep, EventAfterModelInvocation, EventAfterToolCall } from "./eventAfter"
import type { EventBeforeStep, EventBeforeModelInvocation, EventBeforeToolCall, ModelInvocationConfig } from "./eventBefore"
import type { registeredEvent } from "./extendedJS/events/EventMap"
import type { DefineMetaData } from "./fragola"
import type { StoreLike } from "./types"
import type { AgentContext } from "./agentContext"
import { type applyEventParams } from "./agent"
import type { EventModelInvocation } from "./eventDefault"

export async function applyAfterStateUpdate<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"after:stateUpdate", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>
) {
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as AfterStateUpdateCallback<TMetaData, TGlobalStore, TStore>;
        const params: Parameters<typeof callback> = [context];
        return await callback(...params) as any;
    }
}

export async function applyAfterMessagesUpdate<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"after:messagesUpdate", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"after:messagesUpdate", TMetaData>
) {
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventAfterMessagesUpdate<TMetaData, TGlobalStore, TStore>;
        const params: Parameters<typeof callback> = [_params.reason, context];
        return await callback(...params) as any;
    }
}

export async function applyBeforeStep<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"before:step", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"before:step", TMetaData>
) {
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventBeforeStep<TMetaData, TGlobalStore, TStore>;
        const params: Parameters<typeof callback> = [_params.options, context];
        return await callback(...params) as any;
    }
}

export async function applyAfterStep<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"after:step", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"after:step", TMetaData>
) {
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventAfterStep<TMetaData, TGlobalStore, TStore>;
        const params: Parameters<typeof callback> = [_params.options, context];
        return await callback(...params) as any;
    }
}

export async function applyBeforeModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"before:modelInvocation", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"before:modelInvocation", TMetaData>
) {
    let { config } = _params;
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventBeforeModelInvocation<TMetaData, TGlobalStore, TStore>;
        const params: Parameters<typeof callback> = [config, context];
        config = await callback(...params) as any;
    }
    return config;
}

export async function applyModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"modelInvocation", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"modelInvocation", TMetaData>
) {
    for (let i = 0; i < events.length; i++) {
        const {callback} = events[i];
        const res = await callback(_params.kind, _params.data, context);
        if (res && typeof res === 'object' && typeof res === 'object' && Symbol.for('skip_event') in res)
            continue;
        _params.data = res as any;
    }
    return _params.data;
}

export async function applyAfterModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"after:modelInvocation", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"after:modelInvocation", TMetaData>
) {
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventAfterModelInvocation<TMetaData, TGlobalStore, TStore>;
        const params: Parameters<typeof callback> = [_params.message, context];
        return await callback(...params) as any;
    }
}

export async function applyBeforeToolCall<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"before:toolCall", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"before:toolCall", TMetaData>
) {
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventBeforeToolCall<any, TMetaData, TGlobalStore, TStore>;
        const params: Parameters<typeof callback> = [_params.params, _params.tool, context];
        return await callback(...params) as any;
    }
}

export async function applyAfterToolCall<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"after:toolCall", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"after:toolCall", TMetaData>
) {
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventAfterToolCall<any, TMetaData, TGlobalStore, TStore>;
        const params: Parameters<typeof callback> = [_params.result, _params.params, _params.tool, context];
        return await callback(...params) as any;
    }
}
