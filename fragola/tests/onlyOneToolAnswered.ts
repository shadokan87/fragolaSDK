import type OpenAI from "openai";

export const onlyOneToolAnswered: OpenAI.ChatCompletionMessageParam[] = [
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
    }, {
        role: "tool",
        content: "\"Todo added, current list: {\\\"todos\\\":[{\\\"id\\\":\\\"Z0xUUKhhPwB9HgzEmOQhH\\\",\\\"task\\\":\\\"Create outline for agent SDK documentation\\\",\\\"completed\\\":false},{\\\"id\\\":\\\"qVF0LtlvX_qKV5BKwq7Eu\\\",\\\"task\\\":\\\"Write introduction and overview section\\\",\\\"completed\\\":false},{\\\"id\\\":\\\"D4oKoIrr5NVeovqf5h35i\\\",\\\"task\\\":\\\"Document installation instructions\\\",\\\"completed\\\":false},{\\\"id\\\":\\\"A8Ef0o8JDK6OlI7YVA9YG\\\",\\\"task\\\":\\\"Write getting started guide with basic examples\\\",\\\"completed\\\":false},{\\\"id\\\":\\\"tx7wdL2XqQ-XtcA-NI1cq\\\",\\\"task\\\":\\\"Detail API reference and method descriptions\\\",\\\"completed\\\":false},{\\\"id\\\":\\\"wUOGXXr2NSzWa09eJJUFd\\\",\\\"task\\\":\\\"Create code examples for common use cases\\\",\\\"completed\\\":false},{\\\"id\\\":\\\"gix_iE_XfPGsbtT8UmNhY\\\",\\\"task\\\":\\\"Write troubleshooting and FAQ section\\\",\\\"completed\\\":false},{\\\"id\\\":\\\"7UCmJCcFXdIy0-w6fr9M8\\\",\\\"task\\\":\\\"Review and proofread documentation\\\",\\\"completed\\\":false}]}\"",
        tool_call_id: "tooluse_oiLEIeS6TeSPv3hXT4aYHw",
    }
]
