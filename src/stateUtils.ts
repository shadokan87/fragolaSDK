import OpenAI from "openai";
import type { AgentState } from "./agent";
import type {ChatCompletionMessageParam} from "./fragola";

export const getToolCallOrigin = (
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
    });
    return found;
};

export function conversationUtils(conversation: OpenAI.ChatCompletionMessageParam[]) {
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
         * const toolCall = utils.toolCallOrigin(state.conversation.at(-1).tool_calls[0]);
         * // toolCall will be { id: "tool_123", function: { name: "getWeather", arguments: "{}" } }
         */
        toolCallOrigin: (message: OpenAI.ChatCompletionToolMessageParam) => {
            return getToolCallOrigin(conversation, message);
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
            const lastMessage = conversation.at(-1);
            if (!lastMessage || !(lastMessage.role == "assistant" && !lastMessage.tool_calls))
                return undefined;
            return lastMessage;
        },

        /**
         * Returns the last message in the conversation matching the provided role.
         *
         * @param role - One of "user", "tool", or "assistant".
         * @returns The last message with the specified role, or `undefined` if none found.
         *
         * @example
         * const utils = createStateUtils(state);
         * const lastUser = utils.messageByRole("user");
         */
        messageByRole: (role: "user" | "tool" | "assistant"): OpenAI.ChatCompletionMessageParam | undefined => {
            for (let i = conversation.length - 1; i >= 0; i--) {
                const msg = conversation[i];
                if (msg.role === role) return msg;
            }
            return undefined;
        }
    };
}