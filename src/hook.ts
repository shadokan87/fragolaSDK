import type { Agent } from "agent.index";

export type FragolaHook = (agent: Agent) => void;

export const Hook = (callback: FragolaHook) => callback;