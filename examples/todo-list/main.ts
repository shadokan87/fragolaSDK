import { createHeaders, PORTKEY_GATEWAY_URL } from "portkey-ai";
import { Fragola } from "../../fragola/fragola";
import addTodo from "./add.tool";
import { todoStore } from "./todoList.store";
import readline from "readline";
import removeTodo from "./remove.tool";
import completeTodo from "./complete.tool";
import { Agent, createStore, type AgentState, type StepOptions } from "../../fragola/agent";
import { nanoid } from "nanoid";
import { multipleToolCall } from "../../fragola/tests/multipleToolCall";
import { onlyOneToolAnswered } from "../../fragola/tests/onlyOneToolAnswered";
import { userStore } from "./user.store";
import type OpenAI from "openai";
import type { CallAPIProcessChuck } from "../../fragola/eventDefault";
import { collapseTextChangeRangesAcrossMultipleVersions } from "typescript";
import type { ChatCompletionAssistantMessageParam } from "openai/resources";
import { createStateUtils } from "../../fragola/stateUtils";

async function main() {
    // CLI Buffer and Display Management
    let isStreaming = false;

    const clearScreen = () => {
        console.clear();
    };

    const drawInterface = (state: AgentState) => {
        clearScreen();
        const test = () => {};
        const utils = createStateUtils(state);
        // Display conversation history
        state.conversation.forEach((msg, i) => {
            if (msg.role === 'user') {
                console.log('You:', msg.content);
            }
            else if (msg.role == "tool") {
                const toolCallOrigin = utils.toolCallOrigin(msg);
                if (toolCallOrigin) {
                    console.log(`✅ Used '${toolCallOrigin.function.name}' with args: ${toolCallOrigin.function.arguments}`);
                }
            }
            else if (msg.role === "assistant") {
                if (i == state.conversation.length - 1 && ["generating", "waiting"].includes(state.status)) {
                    console.log(`Assistant (working): `, msg.content);
                    if (msg.tool_calls && msg.tool_calls.length) {
                        msg.tool_calls.forEach(tool => {
                            if (!state.conversation.some(msg => msg.role == "tool" && msg.tool_call_id == tool.id))
                                console.log(`🔧 Using '${tool.function.name}' ...`);
                        });
                    }
                }
                else
                    console.log("Assistant: ", msg.content);
            }
        });
    }

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
            maxStep: 10
        },
        modelSettings: {
            model: 'us.anthropic.claude-3-5-haiku-20241022-v1:0' as any,
            temperature: 1,
            stream: true,
            tool_choice: "auto",
        }
    });

    todoListAgent.onAfterStateUpdate((state) => {
        drawInterface(state);
    });

    todoListAgent.onProviderAPI(async (callAPI, state) => {
        const processChunck: CallAPIProcessChuck = async (chunck) => {
            return chunck;
        };

        const aiMessage = await callAPI(processChunck);
        return aiMessage;
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // Initial screen draw
    drawInterface(todoListAgent.getState());

    const promptUser = () => {
        rl.question("You: ", async (input) => {
            if (input.trim().toLowerCase() === "exit") {
                clearScreen();
                console.log('Goodbye!');
                rl.close();
                return;
            }
            void await todoListAgent.userMessage({ content: input });

            setTimeout(() => {
                promptUser();
            }, 100); // Small delay to let user read the response
        });
    };

    promptUser();

    // Handle process termination gracefully
    process.on('SIGINT', () => {
        clearScreen();
        console.log('Goodbye!');
        rl.close();
        process.exit(0);
    });
}

main();