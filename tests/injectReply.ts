import type { AgentAny } from "@fragola-ai/agentic-sdk-core/agent";
import { Hook } from "@fragola-ai/agentic-sdk-core/hook";

/**
 * Hook to inject a canned assistant reply so no real model call is made.
 * @param content The content to inject as the assistant reply.
 */
export const injectReply = (content = "ok") =>
  Hook((agent: AgentAny) => {
    agent.onBeforeModelInvocation(() => ({ injectMessage: { content } }));
  });
