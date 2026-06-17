import type { FragolaHook } from "@fragola-ai/agent/hook";
import z from "zod";

export type HITLoptions = {
  debug?: boolean;
};

const schema = z.object({
  input: z.string().regex(/^(yes|no)$/i, "Must be 'yes' or 'no'"),
});

export const HITL = (options?: HITLoptions): FragolaHook => {
  return (agent) => {
    if (options?.debug) {
      console.debug("[hook-HITL] installed on", agent?.id ?? agent);
    }
    agent.onBeforeToolCall((config) => {
      return config;
    });
    // const RemoveUserMessageEvent = agent.onUserMessage((message) => {
    //   return message;
    // });
    // implement hook behavior here
  };
};

export default HITL;