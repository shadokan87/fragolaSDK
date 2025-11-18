import type { AgentOptions, AgentState, ContextRaw, SetOptionsParams } from "./agent";
import type { DefineMetaData, Fragola, Tool } from "./fragola";
import type { StoreLike } from "./types";
import type { Store } from "./store";

export abstract class AgentContext<TMetaData extends DefineMetaData<any> = {}, TGlobalStore extends StoreLike<any> = {}, TStore extends StoreLike<any> = {}> {
    /** The current state of the agent. */
    abstract get state(): AgentState<TMetaData>;
    /** The configuration options for the agent context. */
    abstract get options(): AgentOptions;
    /** Raw methods for advanced context manipulation */
    abstract get raw(): ContextRaw<TMetaData>;
    /** Acess the agent's default local store. */
    abstract get store(): Store<TStore>;
    /**
     * Add a store that has a namespace. Can be accessed with `getStore` method.
     * @param store - The store to add
     */
    abstract addStore(store: Store<any>): void;

    /**
     * Updates the agent's tool list using a callback.
     *
     * @param callback - Function that receives the current tools and returns the updated list.
     *
     * @example
     * agent.context.updateTools(prev => [...prev, newTool]);
     * agent.context.updateTools(prev => prev.filter(tool => tool.name !== "oldTool"));
     */
    abstract updateTools(callback: (prev: Tool[]) => Tool[]): void;
    /**
     * Remove a store by its namespace.
     * @param namespace - The namespace of the store to remove
     */
    abstract removeStore(namespace: string): void;
    /** Return the Fragola instance which created this agent */
    abstract get instance(): Fragola<TGlobalStore>;
    /**
     * Returns the agent's local store or namespace store casted as T. Recommended when accessing the store from a hook.
     * @param namespace - The namespace of the store to access (optional).
     */
    abstract getStore<T extends StoreLike<any> = {}>(namespace?: string): Store<T> | undefined;

    /**
     * Sets the current instructions for the agent.
     * @param instructions - The new instructions as a string.
     */
    abstract setInstructions(instructions: string, scope?: string): void;

    /**
     * Returns the system prompt for a given scope.
     * @param scope - The instructions scope, leave empty to get the default scope (optional)
     */
    abstract getInstructions(scope?: string): string | undefined;

    /**
     * Remove the system prompt for a given scope. 
     * @param scope - The instructions scope to remove
     * @returns a boolean, true = removed, false = scope do not exist
     */
    abstract removeInstructions(scope: string): boolean
    /**
     * Updates the agent's options.
     * **note**: the `name`, `fork` and `initialConversation` properties are ommited
     * @param options - The new options to set, as a SetOptionsParams object.
     */
    abstract setOptions(options: SetOptionsParams): void;
    /** Stop the agent execution */
    abstract stop(): Promise<void>;
}