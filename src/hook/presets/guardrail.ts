import { FragolaError } from "@src/exceptions";
import type OpenAI from "openai";
import type { FragolaHook } from "..";
import type { AgentContext } from "@src/agentContext";
import type { maybePromise } from "@src/types";

// Guardrail
const SYM_GUARDRAIL_FAIL = Symbol("Guardrail_fail");
const _GuardRailFail = { message: "", [SYM_GUARDRAIL_FAIL]: true }
export type GuardRailFailType = typeof _GuardRailFail;
export const fail = (message: string) => ({ ..._GuardRailFail, message });
export type Guardrail = (fail: (message: string) => GuardRailFailType, userMessage: OpenAI.ChatCompletionUserMessageParam, context: AgentContext) => maybePromise<void | GuardRailFailType>;
export type GuardRailMeta = {
    guardrail: {
        /** Wether the user message passed the guardrail tests*/
        rejected: true,
        /** The name of the guardrail */
        guard: string,
        /** The rejection message */
        reason: string,
    } | {
        rejected: false,
    }
};

export class GuardrailConstrain extends FragolaError {
    constructor(message: string, guardrailName: string) {
        super(message);
        this.cause = guardrailName;
        this.name = "GuardrailConstrain";
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, GuardrailConstrain)
        }
    }
}

export const guardrail = (guardrails: Guardrail[], rejectionBehaviour: "keepAndAnnotate" | "remove" = "keepAndAnnotate"): FragolaHook => {
    return (agent) => {
        agent.onUserMessage(async (message, context) => {
            // If the last message is from a user role but has been rejected by a guardrail, we remove it from the conversation
            const lastMessage = context.state.conversation.at(-1);
            if (lastMessage?.role == "user") {
                const meta = lastMessage.meta as GuardRailMeta | undefined;
                if (meta?.guardrail.rejected) {
                    await context.raw.updateConversation((prev) => (prev.slice(0, -1)), "remove:userMessage")
                }
            }
            // We test the user message against the guardrail array
            for (const guard of guardrails) {
                const response = await guard(fail, message, context);
                if (response && typeof response === 'object' && 'message' in response && response[SYM_GUARDRAIL_FAIL]) {
                    await context.stop();
                    if (rejectionBehaviour == "keepAndAnnotate") {
                        const meta: GuardRailMeta = {
                            guardrail: {
                                rejected: true,
                                guard: guard.name,
                                reason: response.message
                            }
                        }
                        if (!message["meta"]) {
                            message["meta"] = meta;
                        } else {
                            message.meta = {
                                ...message.meta,
                                ...meta
                            }
                        }
                    context.raw.appendMessages([message], false, "userMessage");
                    } else if (rejectionBehaviour == "remove")
                    { /** no-op (message return won't be reached because we throw an error) */ }
                    throw new GuardrailConstrain(response.message, guard.name);
                }
            }
            return message;
        });
    }
};