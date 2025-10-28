import type { AgentContext } from "../../agent";
import type { ChatCompletionUserMessageParam } from "../../fragola";
import type { StoreLike } from "../../types";
import { isSkipEvent } from "../../utils";
import type { registeredEvent } from "./EventMap";

export type HandleUserMessage = (_message: Omit<ChatCompletionUserMessageParam, "role">) => Promise<typeof _message>;
export function createHandleUserMessage<
    TGlobalStore extends StoreLike<any> = {},
    TStore extends StoreLike<any> = {}>(events: registeredEvent<"userMessage", any, TGlobalStore, TStore>[], getContext: () => AgentContext<any>): HandleUserMessage {
    const callback: HandleUserMessage = async (_message) => {
        let message = _message;
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const callbackResult = await event.callback({role: "user", ...message} as any, getContext() as any);
            if (isSkipEvent(callbackResult))
                continue;
            message = callbackResult as typeof _message;
        }
        return message;
    }
    return callback;
}