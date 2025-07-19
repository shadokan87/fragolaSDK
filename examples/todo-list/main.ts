import { createHeaders, PORTKEY_GATEWAY_URL } from "portkey-ai";
import { Fragola } from "../../fragola/fragola";
import addTodo from "./add.tool";
import { todoStore } from "./todoList.store";
import readline from "readline";
import removeTodo from "./remove.tool";
import completeTodo from "./complete.tool";

async function main() {
    const fragola = new Fragola({
        apiKey: 'xxx',
        baseURL: PORTKEY_GATEWAY_URL,
        defaultHeaders: createHeaders({
            virtualKey: process.env["BEDROCK_DEV"],
            apiKey: process.env["PORTKEY_API_KEY"]
        })
    });

    const todoListAgent = fragola.Agent({
        name: "todo list assistant", instructions: "you are a todo list manager, you can add, remove or mark todos as completed. after each actions you should show the current list in markdown format with their completed states. when displaying the todos, use a simple list with checkbox, you may not use a table", tools: [addTodo, removeTodo, completeTodo],
        store: todoStore,
        modelSettings: {
            model: 'us.anthropic.claude-3-5-haiku-20241022-v1:0' as any,
            temperature: 1,
            stream: true,
            tool_choice: "auto"
        }
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const promptUser = () => {
        rl.question("You: ", async (input) => {
            if (input.trim().toLowerCase() === "exit") {
                rl.close();
                return;
            }
            const { conversation } = await todoListAgent.userMessage({ content: input });
            // console.log(JSON.stringify(conversation.filter(c => c.role != "assistant"), null, 2));
            console.log("AI: ", conversation.at(-1)?.content);
            promptUser();
        });
    };

    promptUser();
}

main();