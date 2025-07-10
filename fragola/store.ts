import type { StoreLike } from "./agent";

/**
 * A simple container for storing and updating any value.
 * Use this to keep track of information that your agent or tools need to remember or share.
 * You can get the current value, replace it, or update it based on the previous value.
 */
export class Store<TStore = {}> {
    #value: StoreLike<TStore>;
    constructor(value: StoreLike<TStore>) {
        this.#value = value;
    }

    /**
     * Get current store value.
     */
    get value() {
        return this.#value;
    }

    /**
     * Change the stored value based on what it was before.
     * Useful if you want to update part of the information without replacing everything.
     */
    update(callback: (prev: StoreLike<TStore>) => StoreLike<TStore>) {
        this.#value = callback(this.#value);
        return this;
    }

    /**
     * Replace the stored value with something new.
     */
    set(data: StoreLike<TStore>) {
        this.#value = data;
        return this;
    }
}