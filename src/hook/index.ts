import type { maybePromise } from "@src/types";
import {Agent} from "../agent";

export type FragolaHookDispose = () => maybePromise<void>;

export type FragolaHook = (agent: Agent) => maybePromise<void | FragolaHookDispose>;

export const Hook = (callback: FragolaHook) => callback;