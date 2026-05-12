import type { AgentOptions, AgentState, ContextRaw, SetOptionsParams } from "./agent";
import type { DefineMetaData, Fragola, Tool } from "./fragola";
import type { ContextLike } from "./types";
import type { Context } from "./context";

export const STOP = Symbol('stop');
export abstract class AgentContext<TMetaData extends DefineMetaData<any> = {}, TGlobalContext extends ContextLike<any> = {}, TContext extends ContextLike<any> = {}> {
    /** The current state of the agent. */
    abstract get state(): AgentState<TMetaData>;
    /** The configuration options for the agent context. */
    abstract get options(): AgentOptions;
    /** Raw methods for advanced context manipulation */
    abstract get raw(): ContextRaw<TMetaData>;
    /** Acess the agent's default local context. */
    abstract get context(): Context<TContext>;
    /**
     * Add a context that has a namespace. Can be accessed with `getContext` method.
     * @param context - The context to add
     */
    abstract addContext(context: Context<any>): void;

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
     * Remove a context by its namespace.
     * @param namespace - The namespace of the context to remove
     */
    abstract removeContext(namespace: string): void;
    /** Return the Fragola instance which created this agent */
    abstract get instance(): Fragola<TGlobalContext>;
    /**
     * Returns the agent's local context or namespace context casted as T. Recommended when accessing the context from a hook.
     * @param namespace - The namespace of the context to access (optional).
     */
    abstract getContext<T extends ContextLike<any> = {}>(namespace?: string): Context<T> | undefined;

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
     * **note**: the `name`, `fork` and `messages` properties are ommited
     * @param options - The new options to set, as a SetOptionsParams object.
     */
    abstract setOptions(options: SetOptionsParams): void;
    /** Stop the agent execution */
    abstract stop(): Promise<{[STOP]: true}>;
    /** Stop the agent execution - Sync */
    abstract stopSync(): {[STOP]: true}
}