import type OpenAI from "openai";
import type { ChatCompletionMessageParam, DefineMetaData } from "./fragola";

type MessageRole<TMetaData extends DefineMetaData<any>> = ChatCompletionMessageParam<TMetaData>["role"];
type MessageByRole<TMetaData extends DefineMetaData<any>, TRole extends MessageRole<TMetaData>> = Extract<ChatCompletionMessageParam<TMetaData>, { role: TRole }>;

type MessagesSource<TMetaData extends DefineMetaData<any>> =
    | ChatCompletionMessageParam<TMetaData>[]
    | (() => ChatCompletionMessageParam<TMetaData>[]);

export type MessagesParser<TMetaData extends DefineMetaData<any> = {}> = {
    readonly messages: ChatCompletionMessageParam<TMetaData>[];
    toolCallOrigin(message: MessageByRole<TMetaData, "tool">): OpenAI.ChatCompletionMessageToolCall | undefined;
    finalOutput(): MessageByRole<TMetaData, "assistant"> | undefined;
    messageByRole<TRole extends MessageRole<TMetaData>>(role: TRole): MessageByRole<TMetaData, TRole> | undefined;
};

export const getToolCallOrigin = <TMetaData extends DefineMetaData<any> = {}>(
    messages: ChatCompletionMessageParam<TMetaData>[],
    message: MessageByRole<TMetaData, "tool">
): OpenAI.ChatCompletionMessageToolCall | undefined => {
    let found: OpenAI.ChatCompletionMessageToolCall | undefined = undefined;
    messages.find(msg => {
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

export function messagesUtils<TMetaData extends DefineMetaData<any> = {}>(messagesSource: MessagesSource<TMetaData>): MessagesParser<TMetaData> {
    const getMessages = typeof messagesSource === "function"
        ? messagesSource
        : () => messagesSource;

    return {
        get messages() {
            return getMessages();
        },
        /**
         * From a role 'tool' message, return its origin where requested by the model in the messages
         * 
         * @param message - The tool message parameter containing the tool call ID to search for.
         * @returns The matching tool call object if found, otherwise `undefined`.
         *
         * @example
         * const utils = messagesUtils(state.messages);
         * const lastToolMessage = utils.messageByRole("tool");
         * if (lastToolMessage?.role === "tool") {
         *   const toolCall = utils.toolCallOrigin(lastToolMessage);
         *   // toolCall will be { id: "tool_123", function: { name: "getWeather", arguments: "{}" } }
         * }
         */
        toolCallOrigin: (message: MessageByRole<TMetaData, "tool">) => {
            return getToolCallOrigin(getMessages(), message);
        },

        /**
         * Returns the final assistant output message from the messages.
         *
         * This returns the last message in the messages if it is an assistant message
         * and does not contain any tool calls (i.e., it is a final response, not a tool request).
         *
         * @returns The final assistant message if present, otherwise `undefined`.
         *
         * @example
         * const utils = messagesUtils(state.messages);
         * const finalOutput = utils.finalOutput();
         * if (finalOutput) {
         *   console.log(finalOutput.content);
         * }
         */
        finalOutput: () => {
            const messages = getMessages();
            const lastMessage = messages.at(-1);
            if (!lastMessage || !(lastMessage.role == "assistant" && !lastMessage.tool_calls))
                return undefined;
            return lastMessage as MessageByRole<TMetaData, "assistant">;
        },

        /**
         * Returns the last message in the messages matching the provided role.
         *
         * @param role - One of "user", "tool", or "assistant".
         * @returns The last message with the specified role, or `undefined` if none found.
         *
         * @example
         * const utils = messagesUtils(state.messages);
         * const lastUser = utils.messageByRole("user");
         */
        messageByRole: <TRole extends MessageRole<TMetaData>>(role: TRole): MessageByRole<TMetaData, TRole> | undefined => {
            const messages = getMessages();
            for (let i = messages.length - 1; i >= 0; i--) {
                const msg = messages[i];
                if (msg.role === role) return msg as MessageByRole<TMetaData, TRole>;
            }
            return undefined;
        }
    };
}