import type { maybePromise } from "@src/types";
import {Agent} from "../agent";

export type FragolaHook = (agent: Agent) => void;

export type FragolaHookDispose = () => maybePromise<void>;

export const Hook = (callback: FragolaHook) => callback;