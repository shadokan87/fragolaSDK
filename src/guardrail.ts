import type { AgentContext } from "agent.index";
import type { maybePromise } from "./types";
import OpenAI from "openai";

export const SYM_GUARDRAIL_FAIL = Symbol("Guardrail_fail");
export const _GuardRailFail = {message: "", [SYM_GUARDRAIL_FAIL]: true}
export type GuardRailFailType = typeof _GuardRailFail;
export const fail = (message: string) => ({..._GuardRailFail, message});
export type Guardrail = (fail: (message: string) => GuardRailFailType, userMessage: OpenAI.ChatCompletionUserMessageParam, context: AgentContext) => maybePromise<void | GuardRailFailType>;