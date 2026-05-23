import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Fragola, type ClientOptions, type DefineMetaData } from "@fragola-ai/agent";
import type { AgentState } from "@fragola-ai/agent/agent";

type TestMeta = DefineMetaData<{
  user: { requestId: string },
  ai: { answerId: string },
  tool: { source: "cache" | "api" },
}>;

const createFakeCompletion = (content: string) => ({
  id: "cmpl-test",
  object: "chat.completion" as const,
  created: 1,
  model: "test-model",
  choices: [{
    index: 0,
    message: {
      role: "assistant" as const,
      content,
    },
    finish_reason: "stop" as const,
    logprobs: null,
  }],
  usage: {
    prompt_tokens: 1,
    completion_tokens: 1,
    total_tokens: 2,
  },
});

const createFakeFragola = (onCreate?: (requestBody: unknown) => void) => {
  class FakeOpenAI {
    chat = {
      completions: {
        create: async (requestBody: unknown) => {
          onCreate?.(requestBody);
          return createFakeCompletion("ok");
        },
      },
    };

    constructor(_opts?: unknown) {
      void _opts;
    }
  }

  const opts: ClientOptions = {
    apiKey: "test-key",
    model: "test-model",
  } as ClientOptions;

  return new Fragola(opts, undefined, FakeOpenAI as any);
};

describe("message metadata", () => {
  it("keeps user and assistant metadata in state.messages", async () => {
    const fragola = createFakeFragola();
    const agent = fragola.agent<TestMeta>({
      name: "meta-agent",
      instructions: "",
      description: "",
    });

    agent.onBeforeModelInvocation(() => ({
      injectMessage: {
        content: "hello from model",
        meta: { answerId: "ai-1" },
      },
    }));

    const state = await agent.userMessage({
      content: "hi",
      meta: { requestId: "user-1" },
    });

    expect(state.messages[0]).toMatchObject({
      role: "user",
      meta: { requestId: "user-1" },
    });
    expect(state.messages[1]).toMatchObject({
      role: "assistant",
      meta: { answerId: "ai-1" },
    });
  });

  it("keeps user metadata in state when using json()", async () => {
    const fragola = createFakeFragola();
    const agent = fragola.agent<TestMeta>({
      name: "json-meta-agent",
      instructions: "",
      description: "",
    });

    agent.onBeforeModelInvocation(() => ({
      injectMessage: {
        content: JSON.stringify({ ok: true }),
        meta: { answerId: "json-ai-1" },
      },
    }));

    const result = await agent.json({
      content: "return ok",
      meta: { requestId: "json-user-1" },
      name: "json_meta_test",
      schema: z.object({ ok: z.boolean() }),
    });

    expect(result.state.messages[0]).toMatchObject({
      role: "user",
      meta: { requestId: "json-user-1" },
    });
    expect(result.state.messages[1]).toMatchObject({
      role: "assistant",
      meta: { answerId: "json-ai-1" },
    });
  });

  it("strips metadata only from the outbound OpenAI payload", async () => {
    let capturedRequestBody: any;
    const fragola = createFakeFragola((requestBody) => {
      capturedRequestBody = requestBody;
    });
    const agent = fragola.agent<TestMeta>({
      name: "api-meta-agent",
      instructions: "",
      description: "",
    });

    const state = await agent.userMessage({
      content: "hi",
      meta: { requestId: "user-2" },
    });

    expect(state.messages[0]).toMatchObject({
      role: "user",
      meta: { requestId: "user-2" },
    });
    expect(capturedRequestBody.messages[1]).toMatchObject({
      role: "user",
      content: "hi",
    });
    expect(capturedRequestBody.messages[1].meta).toBeUndefined();
  });
});