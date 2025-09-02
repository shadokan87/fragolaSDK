import type { AgentContext } from "../../agent";
import type { EventAiMessage } from "../../eventDefault";
import type { ChatCompletionAssistantMessageParam } from "../../fragola";
import type { maybePromise, StoreLike } from "../../types";
import { isSkipEvent } from "../../utils";
import type { registeredEvent } from "./EventMap";

export type HandleAiMessage = (message: ChatCompletionAssistantMessageParam, isPartial: boolean) => maybePromise<ChatCompletionAssistantMessageParam>;
export const defaultHandleAiMessage: HandleAiMessage = (message) => message;
export function createHandleAiMessage<
    TGlobalStore extends StoreLike<any> = {},
    TStore extends StoreLike<any> = {}>
    (events: registeredEvent<"aiMessage", any, TGlobalStore, TStore>[], getContext: () => AgentContext<any>): HandleAiMessage {
    const callback: HandleAiMessage = async (message, isPartial) => {
        type EventCallbackType = EventAiMessage<any, TGlobalStore, TStore>;
        let callbackResult: ReturnType<EventCallbackType>;
        let result: ChatCompletionAssistantMessageParam | undefined = undefined;

        for (let i = 0; i < events.length; i++) {
            const event = events[i];
                callbackResult = await (event.callback as EventCallbackType)(!result ? message : result, isPartial, getContext() as any);
                if (isSkipEvent(callbackResult))
                    continue;
                result = callbackResult as ChatCompletionAssistantMessageParam;
        }
        // It is possible that every events returns skip, in this case the aiMessage should be assigned to the default value
        if (!result)
            result = await defaultHandleAiMessage(message, isPartial);
        return result as ChatCompletionAssistantMessageParam;
    };
    return callback;
}