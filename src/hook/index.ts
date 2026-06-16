import type { maybePromise } from "@src/types";
import {Agent, type AgentAny} from "../agent";

/**
 * Cleanup function returned by a hook.
 *
 * This runs when a named hook is removed and may perform synchronous or
 * asynchronous teardown.
 */
export type FragolaHookDispose = () => maybePromise<void>;

/**
 * Reusable agent extension function.
 *
 * A hook receives the agent during initialization and may optionally return a
 * disposer for later cleanup.
 */
export type FragolaHook = (agent: AgentAny) => maybePromise<void | FragolaHookDispose>;

/**
 * Identity helper for : Reusable agent extension function.
 *
 * A hook receives the agent during initialization and may optionally return a
 * disposer for later cleanup.
 */
export const Hook = (callback: FragolaHook) => callback;