import type { StoreLike } from "./types";


export const createStore = <T extends StoreLike<any> = {}>(data: StoreLike<T>, namespace?: string): Store<T> => new Store(data, namespace);

/**
 * Callback type for store change events.
 */
export type StoreChangeCallback<TStore = {}> = (
    value: StoreLike<TStore>,
) => void;

/**
 * A simple container for storing and updating any value.
 * Use this to keep track of information that your agent or tools need to remember or share.
 * You can get the current value, replace it, or update it based on the previous value.
 */
export class Store<TStore extends StoreLike<any> = {}> {
    #value: StoreLike<TStore>;
    #storeChangeCallbacks: StoreChangeCallback<StoreLike<TStore>>[] = [];
    #namespace: string | undefined;

    constructor(value: StoreLike<TStore>, namespace?: string) {
        this.#value = value;
        if (namespace)
            this.#namespace = namespace;
    }

    get namespace() {
        return this.#namespace;
    }

    /**
     * Get current store value.
     */
    get value() {
        return this.#value;
    }

    /**
     * Registers a callback function to be invoked whenever the store changes.
     *
     * @param callback - The function to call when the store changes. Receives the updated store as an argument.
     * @returns The current instance for method chaining.
     */
    onChange(callback: StoreChangeCallback<TStore>) {
        this.#storeChangeCallbacks.push(callback);
        return this;
    }

    /**
     * Change the stored value based on what it was before.
     * Useful if you want to update part of the information without replacing everything.
     */
    update(callback: (prev: StoreLike<TStore>) => StoreLike<TStore>) {
        this.#value = callback(this.#value);
        this.#storeChangeCallbacks.map(_callback => _callback(this.#value))
        return this;
    }

    /**
     * Replace the stored value with something new.
     */
    set(data: StoreLike<TStore>) {
        this.#value = data;
        this.#storeChangeCallbacks.map(_callback => _callback(this.#value))
        return this;
    }
}