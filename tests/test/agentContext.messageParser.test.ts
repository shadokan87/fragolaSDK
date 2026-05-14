import { beforeEach, describe, expect, expectTypeOf, it } from "vitest";
import type { ChatCompletionMessageParam, DefineMetaData } from "@fragola-ai/agentic-sdk-core";
import { createTestClient } from "./createTestClient";

type TestMeta = DefineMetaData<{
  user: { requestId: string },
  ai: { answerId: string },
  tool: { source: "cache" | "api" },
}>;


describe("AgentContext - messagesParser", () => {
  let fragola: ReturnType<typeof createTestClient>;

  beforeEach(() => {
    fragola = createTestClient();
  });

  it("keeps captured parsers in sync with current state.messages", async () => {
    const agent = fragola.agent<TestMeta>({
      name: "test-agent",
      instructions: "",
      description: "",
    });

    agent.onBeforeModelInvocation(() => ({
      injectMessage: {
        content: "hello from model",
        meta: { answerId: "ai-1" },
      },
    }));

    const parser = agent.context.messagesParser;

    expect(parser.messages).toBe(agent.state.messages);
    expect(parser.messages).toHaveLength(0);
    expect(parser.finalOutput()).toBeUndefined();

    await agent.userMessage({
      content: "hi",
      meta: { requestId: "user-1" },
    });

    expect(parser.messages).toBe(agent.state.messages);
    expect(parser.messages).toHaveLength(2);
    expect(parser.messageByRole("user")?.meta).toEqual({ requestId: "user-1" });
    expect(parser.finalOutput()?.meta).toEqual({ answerId: "ai-1" });
    expect(agent.context.messagesParser.finalOutput()?.content).toBe("hello from model");
  });

  it("resolves tool call origins from the latest state", async () => {
    const agent = fragola.agent<TestMeta>({
      name: "test-agent",
      instructions: "",
      description: "",
    });

    const parser = agent.context.messagesParser;

    await agent.context.raw.updateMessages(() => ([
      {
        role: "assistant",
        content: "",
        tool_calls: [{
          id: "call_1",
          type: "function",
          function: {
            name: "lookupWeather",
            arguments: "{}",
          },
        }],
      },
      {
        role: "tool",
        content: '{"temp":21}',
        tool_call_id: "call_1",
        meta: { source: "cache" },
      },
    ] as ChatCompletionMessageParam<TestMeta>[]));

    const toolMessage = parser.messageByRole("tool");

    expect(toolMessage?.meta).toEqual({ source: "cache" });
    expect(parser.toolCallOrigin(toolMessage!)).toEqual(expect.objectContaining({
      id: "call_1",
      type: "function",
    }));
  });

  it("infers metadata from the agent TMetaData generic", () => {
    const agent = fragola.agent<TestMeta>({
      name: "typed-agent",
      instructions: "",
      description: "",
    });

    expectTypeOf(agent.context.messagesParser.messages).toEqualTypeOf<ChatCompletionMessageParam<TestMeta>[]>();
    //@ts-expect-error
    expectTypeOf(agent.context.messagesParser.messageByRole("user")?.meta).toEqualTypeOf<TestMeta["user"] | undefined>();
    //@ts-expect-error
    expectTypeOf(agent.context.messagesParser.finalOutput()?.meta).toEqualTypeOf<TestMeta["ai"] | undefined>();
    //@ts-expect-error
    expectTypeOf(agent.context.messagesParser.messageByRole("tool")?.meta).toEqualTypeOf<TestMeta["tool"] | undefined>();
  });
});