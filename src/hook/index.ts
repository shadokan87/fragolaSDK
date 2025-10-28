import {Agent} from "../agent";

export type FragolaHook = (agent: Agent) => void;

export const Hook = (callback: FragolaHook) => callback;