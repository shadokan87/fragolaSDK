import type { Agent } from "agent.index";
import type { AgentAny } from "dist/agent.index";

export type FragolaHook = (agent: Agent) => void;

export const Hook = (callback: FragolaHook) => callback;