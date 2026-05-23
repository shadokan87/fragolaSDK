import type { ChatCompletionUserMessageParam } from "@fragola-ai/agent";
import type { FragolaHook } from "@fragola-ai/agent/hook";

type MaybePromise<T> = Promise<T> | T;
type HookAgent = Parameters<FragolaHook>[0];
type UserMessageHandler = Parameters<HookAgent["onUserMessage"]>[0];
type AnyUserMessage = ChatCompletionUserMessageParam;
type AnyContext = Parameters<UserMessageHandler>[1];

const SYM_GUARDRAIL_FAIL = Symbol("Guardrail_fail");
const _guardRailFail = { message: "", [SYM_GUARDRAIL_FAIL]: true };

export type GuardRailFailType = typeof _guardRailFail;
export const fail = (message: string) => ({ ..._guardRailFail, message });
export type Guardrail = (
  fail: (message: string) => GuardRailFailType,
  userMessage: AnyUserMessage,
  context: AnyContext,
) => MaybePromise<void | GuardRailFailType>;
export type GuardRailMeta = {
  guardrail:
    | {
        rejected: true,
        guard: string,
        reason: string,
      }
    | {
        rejected: false,
      };
};

export class GuardrailConstrain extends Error {
  constructor(message: string, guardrailName: string) {
    super(message);
    this.cause = guardrailName;
    this.name = "GuardrailConstrain";
    if (Error.captureStackTrace)
      Error.captureStackTrace(this, GuardrailConstrain);
  }
}

type UserContentPart = Exclude<AnyUserMessage["content"], string>[number];

function stringifyUserContent(content: AnyUserMessage["content"]): string {
  if (typeof content === "string")
    return content;

  return content
    .map((part: UserContentPart) => {
      if (part.type === "text")
        return part.text;
      if (part.type === "image_url")
        return `[image_url: ${part.image_url.url}]`;
      return JSON.stringify(part);
    })
    .join("\n");
}

export const guardrail = (
  guardrails: Guardrail[],
  rejectionBehaviour: "keepAndAnnotate" | "remove" = "keepAndAnnotate",
): FragolaHook => {
  return (agent) => {
    agent.onUserMessage(async (message, context) => {
      // If the last message is from a user role but has been rejected by a guardrail, we remove it from the messages
      const lastMessage = context.state.messages.at(-1);
      if (lastMessage?.role == "user") {
          const meta = lastMessage.meta as GuardRailMeta | undefined;
          if (meta?.guardrail.rejected) {
              await context.raw.updateMessages((prev) => prev.slice(0, -1))
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
                  await context.raw.updateMessages((prev) => [...prev, message]);
              } else if (rejectionBehaviour == "remove")
              { /** no-op (message return won't be reached because we throw an error) */ }
              throw new GuardrailConstrain(response.message, guard.name);
          }
      }

      return message;
    });
  };
};

export default guardrail;