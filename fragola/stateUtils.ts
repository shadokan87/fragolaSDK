import OpenAI from "openai";
import type { AgentState } from "./agent";

const getToolCallOrigin = (
    conversation: OpenAI.ChatCompletionMessageParam[],
    message: OpenAI.ChatCompletionToolMessageParam
): OpenAI.ChatCompletionMessageToolCall | undefined => {
    let found: OpenAI.ChatCompletionMessageToolCall | undefined = undefined;
    conversation.find(msg => {
        if (
            msg.role === "assistant" &&
            msg.tool_calls &&
            msg.tool_calls.some(toolCall => {
                if (toolCall.id === message.tool_call_id) {
                    found = toolCall;
                    return true;
                }
                return false;
            })
        ) {
            return true;
        }
        return false;
    }) as OpenAI.ChatCompletionAssistantMessageParam | undefined;
    return found;
};

export function createStateUtils(state: AgentState) {
    return {
        /**
         * From a role 'tool' message, return its origin where requested by the model in the conversation
         * 
         * @param message - The tool message parameter containing the tool call ID to search for.
         * @returns The matching tool call object if found, otherwise `undefined`.
         *
         * @example
         * const utils = createStateUtils(state);
         * // Assuming the message is the following
         * // { role: "tool", tool_call_id: "tool_123", content: "Result" };
         * const toolCall = utils.toolCallOrigin(state.conversation.at(-1));
         * // toolCall will be { id: "tool_123", function: { name: "getWeather", arguments: "{}" } }
         */
        toolCallOrigin: (message: OpenAI.ChatCompletionToolMessageParam) => {
            return getToolCallOrigin(state.conversation, message);
        },

        /**
         * Returns the final assistant output message from the conversation.
         *
         * This returns the last message in the conversation if it is an assistant message
         * and does not contain any tool calls (i.e., it is a final response, not a tool request).
         *
         * @returns The final assistant message if present, otherwise `undefined`.
         *
         * @example
         * const utils = createStateUtils(state);
         * const finalOutput = utils.finalOutput();
         * if (finalOutput) {
         *   console.log(finalOutput.content);
         * }
         */
        finalOutput: () => {
            const lastMessage = state.conversation.at(-1);
            if (!lastMessage || !(lastMessage.role == "assistant" && !lastMessage.tool_calls && state.status == "idle"))
                return undefined;
            return lastMessage;
        },

        /**
         * Returns the last message in the conversation.
         *
         * @returns The last message in the conversation, or `undefined` if conversation is empty.
         */
        lastMessage: () => {
            return state.conversation.at(-1);
        },

        /**
         * Returns all messages of a specific role from the conversation.
         *
         * @param role - The role to filter by.
         * @returns Array of messages matching the specified role.
         */
        messagesByRole: (role: OpenAI.ChatCompletionMessageParam['role']) => {
            return state.conversation.filter(msg => msg.role === role);
        },

        /**
         * Returns the conversation array directly.
         *
         * @returns The complete conversation history.
         */
        conversation: () => {
            return state.conversation;
        }
    };
}