import type OpenAI from "openai/index.js";
import type { CreateAgentOptions, AgentContext } from "./agent";
import type { maybePromise, StoreLike } from "./types";
import type { AgentDefaultEventId } from "./event";
import type { Store } from "./store";
import type { ClientOptions } from "openai/index.js";


/**
 * Callback for the "conversationUpdate" agent event.
 * @param newConversation - The updated conversation messages.
 * @param context - The agent context containing state and store accessors.
 * @returns The possibly updated conversation messages (can be a Promise).
 */
export type ConversationUpdateCallback<TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    newConversation: OpenAI.ChatCompletionMessageParam[],
    context: AgentContext
) => maybePromise<OpenAI.ChatCompletionMessageParam[]>;

export type CallAPIProcessChuck = (chunck: OpenAI.ChatCompletionChunk, partialMessage: OpenAI.ChatCompletionAssistantMessageParam) => maybePromise<OpenAI.ChatCompletionChunk>;
export type CallAPI = (processChunck?: CallAPIProcessChuck, modelSettings?: CreateAgentOptions["modelSettings"], clientOptions?: ClientOptions) => Promise<OpenAI.ChatCompletionAssistantMessageParam>

export type ProviderAPICallback<TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (
    callAPI: CallAPI,
    context: AgentContext
) => maybePromise<OpenAI.ChatCompletionAssistantMessageParam>;

// TODO: dynamic toolCall events
// export type ToolCallCallback<TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = (tool: Tool<any>, state: AgentState,
//     getStore: () => Store<TStore> | undefined,
//     getGlobalStore: () => Store<TGlobalStore> | undefined) => maybePromise<Tool<any>["handler"]>;

//@prettier-ignore
export type callbackMap<TGlobalStore extends StoreLike<any>, TStore extends StoreLike<any>> = {
    [K in AgentDefaultEventId]:
    K extends "conversationUpdate" ? ConversationUpdateCallback<TGlobalStore, TStore> :
    K extends "providerAPI" ? ProviderAPICallback<TGlobalStore, TStore> :
    never;
};
