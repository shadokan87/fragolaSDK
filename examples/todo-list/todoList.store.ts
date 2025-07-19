import { createStore, type StoreLike } from "../../fragola/agent";

export interface todo {
    id: string,
    task: string,
    completed: boolean
}

export type todoStoreType = {todos: todo[]};
export const todoStore = createStore<todoStoreType>({ todos: [] });