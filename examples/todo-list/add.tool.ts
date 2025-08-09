import z from "zod";
import { tool } from "../../fragola/fragola";
import { nanoid } from "nanoid";
import { type todo, type todoStoreType, todoStore } from "./todoList.store";

const addTodo = tool({
    name: "addTodo",
    description: "Add a todo to the list",
    schema: z.object({
        task: z.string()
    }),
    handler: async (params, context) => {
        const store = context.getStore<todoStoreType>();
        const newTodo: todo = {
            id: nanoid(),
            task: params.task,
            completed: false
        }
        if (store) {
            store.update((prev) => {
                return { todos: [...prev.todos, newTodo] }
            });
            return `Todo added, current list: ${JSON.stringify(store.value)}`;
        } else
            return "An error occured, failed to get todo list";
    }
});

export default addTodo;