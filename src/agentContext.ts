import type { AgentOptions, AgentState, ContextRaw, SetOptionsParams } from "./agent";
import type { DefineMetaData, Fragola } from "./fragola";
import type { StoreLike } from "./types";
import type { Store } from "./store";

export abstract class AgentContext<TMetaData extends DefineMetaData<any> = {}, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> {
    /** The current state of the agent. */
    abstract get state(): AgentState<TMetaData>;
    /** The configuration options for the agent context. */
    abstract get options(): AgentOptions;
    /** Raw methods for advanced context manipulation */
    abstract get raw(): ContextRaw;
    /** Acess the agent's default local store. */
    abstract get store(): Store<TStore>;
    /** Return the Fragola instance which created this agent */
    abstract get instance(): Fragola<TGlobalStore>;
    /** Returns the agent's local store or namespace store casted as T. Recommanded when accessing the store from a hook */
    abstract getStore<T extends StoreLike<any> = {}>(namespace?: string): Store<T> | undefined;
    /** Returns the instance (global) store or namespaces store casted as T. Recommanded when accessing the store from a hook */
    abstract getGlobalStore<T extends StoreLike<any>>(namespace?: string): Store<T> | undefined;
    /** Acess the instance (global) default store. */
    abstract get globalStore(): Store<TGlobalStore> | undefined;

    /**
     * Sets the current instructions for the agent.
     * @param instructions - The new instructions as a string.
     */
    abstract setInstructions(instructions: string): void;
    /**
     * Updates the agent's options.
     * **note**: the `name`, `fork` and `initialConversation` properties are ommited
     * @param options - The new options to set, as a SetOptionsParams object.
     */
    abstract setOptions(options: SetOptionsParams): void;
    /** Stop the agent execution */
    abstract stop(): Promise<void>;
}