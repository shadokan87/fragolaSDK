//@ts-nocheck
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
import type { ChatCompletionAssistantMessageParam } from "openai/resources";
import { createStateUtils } from "../../fragola/stateUtils";
import fs from "fs";
import { join } from "path";
import { z } from "zod";

async function main() {
    const clearScreen = () => {
        console.clear();
    };

    const display = true;
    const drawInterface = (state: AgentState) => {
        if (!display)
            return;
        clearScreen();
        const test = () => { };
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

    // todoListAgent.onAfterConversationUpdate((reason, {state}) => {
    //     console.log(`reason: ${reason}, state: ${JSON.stringify(state.conversation.at(-1), null, 2)}`)
    //     if (reason == "userMessage")
    //         process.exit(1);
    // });

    todoListAgent.onAfterStateUpdate(async (context) => {
        // await context.stop();
        drawInterface(context.state);
    });

    todoListAgent.onAiMessage(async (message, isPartial, _, when) => when(!isPartial, () => {
        message.content = "(modified)";
        return message;
    }));

    const calculatorParamsSchema = z.union([
        z.array(z.number()),
        z.enum(["add", "subtract", "multiply", "divide"])
    ]);

    todoListAgent.onToolCall(async (params, tool, context) => when(tool.handler == "dynamic" && tool.name == "calculator", () => {
        const callback = () => {

        }
        return callback;
    }));
//    todoListAgent.onToolCall(async (params, tool, context) => when(tool.handler == "dynamic" && tool.name == "getUserById", () => await getUserById(params.id)));

    function saveState(state: AgentState, filename: string) {
        const path = join(process.env["PWD"]!, filename + ".json");
        console.log("!path", path);
        fs.writeFileSync(path, JSON.stringify(state, null, 2), 'utf-8');
    }

    todoListAgent.onModelInvocation(async (callAPI, context) => {
        let count = 0;
        const processChunck: CallAPIProcessChuck = async (chunck) => {
            if (count == 3) {
                await context.stop();
                saveState(context.state, `stopGeneration_${nanoid()}`);
            }
            // await new Promise(resolve => setTimeout(resolve, 300));
            count++;
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
            void await todoListAgent.userMessage({ content: input, step: { unansweredToolBehaviour: "skip", skipToolString: "error: (generation canceled)" } });

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