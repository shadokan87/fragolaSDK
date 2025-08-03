import { createHeaders, PORTKEY_GATEWAY_URL } from "portkey-ai";
import { Fragola } from "../../fragola/fragola";
import addTodo from "./add.tool";
import { todoStore } from "./todoList.store";
import readline from "readline";
import removeTodo from "./remove.tool";
import completeTodo from "./complete.tool";
import { Agent, createStore, type StepOptions } from "../../fragola/agent";
import { nanoid } from "nanoid";
import { multipleToolCall } from "../../fragola/tests/multipleToolCall";
import { onlyOneToolAnswered } from "../../fragola/tests/onlyOneToolAnswered";
import { userStore } from "./user.store";
import type OpenAI from "openai";

async function main() {

    const fragola = new Fragola({
        apiKey: 'xxx',
        baseURL: PORTKEY_GATEWAY_URL,
        defaultHeaders: createHeaders({
            virtualKey: process.env["BEDROCK_DEV"],
            apiKey: process.env["PORTKEY_API_KEY"]
        })
    }, userStore);

    const todoListAgent = fragola.agent({
        name: "todo list assistant", instructions: "you are a todo list manager, you can add, remove or mark todos as completed. after each actions you should show the current list in markdown format with their completed states. when displaying the todos, use a simple list with checkbox, you may not use a table", tools: [addTodo, removeTodo, completeTodo],
        store: todoStore,
        stepOptions: {
            maxStep: 0
        },
        // initialConversation: multipleToolCall,
        modelSettings: {
            model: 'us.anthropic.claude-3-5-haiku-20241022-v1:0' as any,
            temperature: 1,
            stream: false,
            tool_choice: "auto",
        }
    });

    // todoListAgent.onAfterConversationUpdate((state) => {
    //     console.log("final conv: ", state.conversation);
    // });

    // await todoListAgent.step({ by: 2, maxStep: 10, unansweredToolBehaviour: "skip" });
    // await todoListAgent.step();

    // todoListAgent.onBeforeConversationUpdate((state, getStore, getGlobalStore) => {
    //     console.log("before conv update: ", state.conversation.at(-1)?.content);
    // });

    // todoListAgent.onConversationUpdate((newConversation) => {
    //     const lastMessage = newConversation.at(-1);
    //     if (lastMessage?.role == "user") {
    //         if (typeof lastMessage.content == "string" && lastMessage.content.includes("sdk"))
    //             newConversation[newConversation.length - 1].content = `I need to create the documentation for my agent sdk`;
    //     }
    //     return newConversation;
    // });

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