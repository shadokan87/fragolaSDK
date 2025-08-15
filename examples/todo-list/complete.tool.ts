import { type todo, type todoStoreType, todoStore } from "./todoList.store";
import { tool } from "../../fragola/fragola";
import { Store } from "../../fragola/store";
import z from "zod";

const completeTodo = tool({
    name: "complete",
    namespace: "todo",
    description: "set a todo as completed",
    schema: z.object({
        id: z.string().describe("the id of the todo")
    }),
    handler: async (params, context) => {
        const store = context.getStore<todoStoreType>();
        if (store) {
            let todos = structuredClone(store.value.todos);
            let completed: boolean = false;
            for (let i = 0; i < todos.length; i++) {
                if (todos[i].id == params.id) {
                    todos[i].completed = true;
                    completed = true;
                    store.set({ todos });
                }
            }
            if (completed)
                return `Task with id '${params.id} set as completed, current list: ${JSON.stringify(store.value.todos)}'`;
            else
                return `Could not find todo with id '${params.id}, current list: ${JSON.stringify(store.value.todos)}'`;
        } else {
            return "An error occured, failed to get todo list";
        }
    }
});

export default completeTodo;