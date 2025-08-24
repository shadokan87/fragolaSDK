import OpenAI from "openai";

export const multipleToolCall: OpenAI.ChatCompletionMessageParam[] = [
    {
        role: "user",
        content: "I need to create the documentation for my agent sdk",
    }, {
        role: "assistant",
        content: "I'll help you create a todo list for documenting your agent SDK. Let's break this down into manageable tasks.",
        tool_calls: [
            {
                id: "tooluse_5nerOVf8TZy9ix0iUFmBEA",
                type: "function",
                function: {
                    name: "addTodo",
                    arguments: "{\"task\":\"Create outline for agent SDK documentation\"}",
                },
            }, {
                id: "tooluse_BcNqUkQRTuC7Bi6L9naSjw",
                type: "function",
                function: {
                    name: "addTodo",
                    arguments: "{\"task\":\"Write introduction and overview section\"}",
                },
            }, {
                id: "tooluse_TAy9_XsqS8uNlwKHr8Qbow",
                type: "function",
                function: {
                    name: "addTodo",
                    arguments: "{\"task\":\"Document installation instructions\"}",
                },
            }, {
                id: "tooluse_yOuCQTwXR5GIDSiFs41m-g",
                type: "function",
                function: {
                    name: "addTodo",
                    arguments: "{\"task\":\"Write getting started guide with basic examples\"}",
                },
            },
            {
                id: "tooluse_hiCXcVTeSxKMQnh_rZLnOg",
                type: "function",
                function: {
                    name: "addTodo",
                    arguments: "{\"task\":\"Detail API reference and method descriptions\"}",
                },
            }, {
                id: "tooluse_2CQp9VJSTPSFYURuRtfF-w",
                type: "function",
                function: {
                    name: "addTodo",
                    arguments: "{\"task\":\"Create code examples for common use cases\"}",
                },
            }, {
                id: "tooluse_dHUzI0KkQKeeIgtlTOOUaQ",
                type: "function",
                function: {
                    name: "addTodo",
                    arguments: "{\"task\":\"Write troubleshooting and FAQ section\"}",
                },
            }, {
                id: "tooluse_oiLEIeS6TeSPv3hXT4aYHw",
                type: "function",
                function: {
                    name: "addTodo",
                    arguments: "{\"task\":\"Review and proofread documentation\"}",
                },
            }
        ],
    }
]
