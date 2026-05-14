import type OpenAI from "openai/index.js";
import { skip, SKIP_EVENT, stop } from "./event"
import type { EventAfterStateUpdate, EventAfterStep, EventAfterModelInvocation, EventAfterToolCall } from "./eventAfter"
import type { EventBeforeStep, EventBeforeModelInvocation, EventBeforeToolCall, ModelInvocationConfig, ToolCallConfig } from "./eventBefore"
import type { EventAiMessage, EventModelInvocation, EventToolCall, EventUserMessage, MergePatch, ModelInvocationChunk, ModelInvocationChunkInjection, ModelInvocationDelta, ModelInvocationPrimaryChoice } from "./eventDefault"
import type { registeredEvent } from "./extendedJS/events/EventMap"
import type { ChatCompletionAssistantMessageParam, ChatCompletionUserMessageParam, DefineMetaData, ToolHandlerReturnTypeNonAsync } from "./fragola"
import type { maybePromise, StoreLike } from "./types"
import type { AgentContext, STOP } from "./agentContext"
import { type applyEventParams } from "./agent"
import { isSkipEvent, isStopEvent } from "./utils";
import { BadUsage } from "./exceptions";

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

const createDefaultModelInvocationChoice = (): ModelInvocationPrimaryChoice => ({
    index: 0,
    delta: {},
    finish_reason: null,
    logprobs: null,
});

const replacePrimaryChoice = (chunk: ModelInvocationChunk, primaryChoice: ModelInvocationPrimaryChoice): ModelInvocationChunk => {
    const choices = [...chunk.choices];
    choices[0] = primaryChoice;
    return {
        ...chunk,
        choices,
    };
};

const mergePatch = <T>(current: T, patch: MergePatch<T>): T => {
    if (patch === undefined)
        return current;
    if (patch === null || typeof patch !== "object" || Array.isArray(patch))
        return patch as T;

    const currentObject = current && typeof current === "object" && !Array.isArray(current)
        ? current as Record<string, unknown>
        : {};
    const result: Record<string, unknown> = { ...currentObject };

    for (const [key, value] of Object.entries(patch)) {
        if (value === undefined)
            continue;
        result[key] = mergePatch(currentObject[key], value as never);
    }

    return result as T;
};

const isModelInvocationChunkInjection = (value: unknown): value is ModelInvocationChunkInjection => {
    if (!value || typeof value !== "object")
        return false;
    return "injectChunk" in value || "injectPrimary" in value || "injectDelta" in value;
};

const resolveModelInvocationChunk = (
    currentChunk: ModelInvocationChunk,
    next: ModelInvocationChunk | ModelInvocationChunkInjection,
): ModelInvocationChunk => {
    if (!isModelInvocationChunkInjection(next))
        return next;

    const injectionKeys = ["injectChunk", "injectPrimary", "injectDelta"]
        .filter((key) => key in next);

    if (injectionKeys.length !== 1) {
        throw new BadUsage(
            `Invalid modelInvocation chunk injection result. Return exactly one of 'injectChunk', 'injectPrimary', or 'injectDelta' so Fragola can determine which part of the chunk to update.`
        );
    }

    if ("injectChunk" in next) {
        return next.merge === false
            ? next.injectChunk
            : mergePatch(currentChunk, next.injectChunk) as ModelInvocationChunk;
    }

    const currentPrimaryChoice = currentChunk.choices[0] ?? createDefaultModelInvocationChoice();

    if ("injectPrimary" in next) {
        const primaryChoice = next.merge === false
            ? next.injectPrimary
            : mergePatch(currentPrimaryChoice, next.injectPrimary) as ModelInvocationPrimaryChoice;
        return replacePrimaryChoice(currentChunk, primaryChoice);
    }

    const delta = next.merge === false
        ? next.injectDelta
        : mergePatch((currentPrimaryChoice.delta ?? {}) as ModelInvocationDelta, next.injectDelta);
    return replacePrimaryChoice(currentChunk, {
        ...currentPrimaryChoice,
        delta,
    });
};

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
        if (isSkipEvent(res)) {
            result.signal = res;
            continue;
        }
        result.value = res;
    }
    return result;
}

export async function applyBeforeStep<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"before:step", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"before:step", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventBeforeStep<TMetaData, TGlobalStore, TStore>>>
) {
    let result: ApplyEventResult<EventBeforeStep<TMetaData, TGlobalStore, TStore>> = {
        signal: undefined,
        value: _params.options
    }
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventBeforeStep<TMetaData, TGlobalStore, TStore>;
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

export async function applyAfterStep<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"after:step", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"after:step", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventAfterStep<TMetaData, TGlobalStore, TStore>>>
) {
    let result: ApplyEventResult<EventAfterStep<TMetaData, TGlobalStore, TStore>> = {
        signal: undefined,
        value: undefined
    }
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventAfterStep<TMetaData, TGlobalStore, TStore>;
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

export async function applyBeforeModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"before:modelInvocation", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"before:modelInvocation", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventBeforeModelInvocation<TMetaData, TGlobalStore, TStore>>>
) {
    let result: ApplyEventResult<EventBeforeModelInvocation<TMetaData, TGlobalStore, TStore>> = {
        signal: undefined,
        value: _params.config
    }
    let configTmp: ModelInvocationConfig<TMetaData>;
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventBeforeModelInvocation<TMetaData, TGlobalStore, TStore>;
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

export async function applyModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"modelInvocation", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"modelInvocation", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventModelInvocation<TMetaData, TGlobalStore, TStore>>>
) {
    let result: ApplyEventResult<EventModelInvocation<TMetaData, TGlobalStore, TStore>> = {
        signal: undefined,
        value: (_params.kind === "chunk" ? _params.chunk : _params.data) as any
    }
    for (let i = 0; i < events.length; i++) {
        const {callback} = events[i];
        const invocation = _params.kind === "chunk"
            ? {
                kind: "chunk" as const,
                chunk: result.value as ModelInvocationChunk,
                primaryChoice: (result.value as ModelInvocationChunk).choices[0],
                delta: (result.value as ModelInvocationChunk).choices[0]?.delta as ModelInvocationDelta | undefined,
            }
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
        result.value = _params.kind === "chunk"
            ? resolveModelInvocationChunk(result.value as ModelInvocationChunk, res as ModelInvocationChunk | ModelInvocationChunkInjection)
            : res as any;
    }
    return result;
}

export async function applyAfterModelInvocation<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"after:modelInvocation", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"after:modelInvocation", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventAfterModelInvocation<TMetaData, TGlobalStore, TStore>>>
) {
    let result: ApplyEventResult<EventAfterModelInvocation<TMetaData, TGlobalStore, TStore>> = {
        signal: undefined,
        value: undefined
    }
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventAfterModelInvocation<TMetaData, TGlobalStore, TStore>;
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

export async function applyAiMessage<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"aiMessage", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"aiMessage", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventAiMessage<TMetaData, TGlobalStore, TStore>>>
) {
    let result: ApplyEventResult<EventAiMessage<TMetaData, TGlobalStore, TStore>> = {
        signal: undefined,
        value: _params.message
    }
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventAiMessage<TMetaData, TGlobalStore, TStore>;
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

export async function applyUserMessage<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"userMessage", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"userMessage", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventUserMessage<TMetaData, TGlobalStore, TStore>>>
) {
    let result: ApplyEventResult<EventUserMessage<TMetaData, TGlobalStore, TStore>> = {
        value: {role: "user", ..._params.message},
        signal: undefined
    }
    // let message = _params.message;
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventUserMessage<TMetaData, TGlobalStore, TStore>;
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

export async function applyBeforeToolCall<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"before:toolCall", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"before:toolCall", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventBeforeToolCall<any, TMetaData, TGlobalStore, TStore>>>
) {
    let result: ApplyEventResult<EventBeforeToolCall<any, TMetaData, TGlobalStore, TStore>> = {
        signal: undefined,
        value: _params.config
    }
    let configTmp: ToolCallConfig<any>;
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventBeforeToolCall<any, TMetaData, TGlobalStore, TStore>;
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

export async function applyToolCall<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"toolCall", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"toolCall", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventToolCall<any, TMetaData, TGlobalStore, TStore>>>
) {
    let result: ApplyEventResult<EventToolCall<any, TMetaData, TGlobalStore, TStore>> = {
        signal: undefined,
        value: _params.result as any
    }
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventToolCall<any, TMetaData, TGlobalStore, TStore>;
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

export async function applyAfterToolCall<TMetaData extends DefineMetaData<any>, TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>>(
    events: registeredEvent<"after:toolCall", TMetaData, TGlobalStore, TStore>[],
    context: AgentContext<TMetaData, TGlobalStore, TStore>,
    _params: applyEventParams<"after:toolCall", TMetaData>,
    accumulate?: AccumulateCallback<ReturnType<EventAfterToolCall<any, TMetaData, TGlobalStore, TStore>>>
) {
    let result: ApplyEventResult<EventAfterToolCall<any, TMetaData, TGlobalStore, TStore>> = {
        signal: undefined,
        value: undefined
    }
    for (let i = 0; i < events.length; i++) {
        const callback = events[i].callback as EventAfterToolCall<any, TMetaData, TGlobalStore, TStore>;
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
