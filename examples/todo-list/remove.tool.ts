import { type todo, type todoStoreType, todoStore } from "./todoList.store";
import { tool } from "../../fragola/fragola";
import z from "zod";

const removeTodo = tool({
    name: "remove",
    namespace: "todo",
    description: "remove a todo from the list",
    schema: z.object({
        id: z.string().describe("the id of the todo")
    }),
    handler: async (params, {getStore}) => {
        const store = getStore<todoStoreType>();
        if (store) {
            const prevLen = store.value.todos.length;
            store.update((prev) => {
                return {
                    todos: prev.todos.filter(todo => todo.id != params.id)
                }
            });
            if (prevLen != store.value.todos.length)
            return `Successfully removed todo with id '${params.id}, current list: ${JSON.stringify(store.value.todos)}'`;
        else
            return `Failed to removed todo with id '${params.id}, current list: ${JSON.stringify(store.value.todos)}'`;
        } else {
            return "An error occured, failed to get todo list";
        }
    }
});

export default removeTodo;