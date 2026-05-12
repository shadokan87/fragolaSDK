import type { ContextLike } from "./types";


export const createContext = <T extends ContextLike<any> = {}>(data: ContextLike<T>, namespace?: string): Context<T> => new Context(data, namespace);

/**
 * Callback type for context change events.
 */
export type ContextChangeCallback<TContext = {}> = (
    value: ContextLike<TContext>,
) => void;

/**
 * A simple container for storing and updating any value.
 * Use this to keep track of information that your agent or tools need to remember or share.
 * You can get the current value, replace it, or update it based on the previous value.
 */
export class Context<TContext extends ContextLike<any> = {}> {
    #value: ContextLike<TContext>;
    #contextChangeCallbacks: ContextChangeCallback<ContextLike<TContext>>[] = [];
    #namespace: string | undefined;

    constructor(value: ContextLike<TContext>, namespace?: string) {
        this.#value = value;
        if (namespace)
            this.#namespace = namespace;
    }

    get namespace() {
        return this.#namespace;
    }

    /**
     * Get current context value.
     */
    get value() {
        return this.#value;
    }

    /**
     * Registers a callback function to be invoked whenever the context changes.
     *
     * @param callback - The function to call when the context changes. Receives the updated context as an argument.
     * @returns The current instance for method chaining.
     */
    onChange(callback: ContextChangeCallback<TContext>) {
        this.#contextChangeCallbacks.push(callback);
        return this;
    }

    /**
     * Change the context value based on what it was before.
     * Useful if you want to update part of the information without replacing everything.
     */
    update(callback: (prev: ContextLike<TContext>) => ContextLike<TContext>) {
        this.#value = callback(this.#value);
        this.#contextChangeCallbacks.map(_callback => _callback(this.#value))
        return this;
    }

    /**
     * Replace the context value with something new.
     */
    set(data: ContextLike<TContext>) {
        this.#value = data;
        this.#contextChangeCallbacks.map(_callback => _callback(this.#value))
        return this;
    }
}