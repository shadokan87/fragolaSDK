---
id: overview
slug: /
title: Overview
---

Fragola is an event-driven, OpenAI-compatible agent SDK for building AI-first software. It uses OpenAI types directly without abstractions, provides a rich event system for observability and control, and has a exensible hook system that lets you augment your agent capabilities in an instant and customize the SDK for your project needs.

## Design Philosophy

**No abstractions**: Fragola uses OpenAI SDK types directly. The message history (conversation) uses `OpenAI.ChatCompletionMessageParam[]` - the exact same types from the OpenAI SDK.

**Event-driven**: Listen to a collection of events throughout the agent lifecycle for analytics, logging, or to modify agent behavior at any point in the flow.

**No fixed paradigm**: Fragola doesn't impose graphs or workflows. Instead provides essential functionalities like tools and an extensible hook system. Use hooks to implement any paradigm you need - graphs, workflows, planning loops, or your own custom patterns. Customize the SDK to fit your project's needs by using built-in hooks (MCP, Orchestration, Sub-agent, browser automation) and more or creating your own hook.

## Installation

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="npm" label="npm" default>
    ```bash
    npm install @fragola-ai/agentic-sdk-core
    ```
  </TabItem>
  <TabItem value="bun" label="bun">
    ```bash
    bun add @fragola-ai/agentic-sdk-core
    ```
  </TabItem>
  <TabItem value="pnpm" label="pnpm">
    ```bash
    pnpm add @fragola-ai/agentic-sdk-core
    ```
  </TabItem>
  <TabItem value="yarn" label="yarn">
    ```bash
    yarn add @fragola-ai/agentic-sdk-core
    ```
  </TabItem>
</Tabs>

## Hello World

```typescript
import { Fragola } from "@fragola-ai/agentic-sdk-core";

const fragola = new Fragola({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o-mini"
});

const agent = fragola.agent({
  name: "HelloAgent",
  description: "A simple greeting agent",
  instructions: "You are a friendly assistant."
});

const { state } = await agent.userMessage({
  content: "You are my first agent, introduce yourself by saying hello world !"
});

// The conversation uses native OpenAI types
console.log(state.conversation);
// => OpenAI.ChatCompletionMessageParam[]
```

- Ready to get productive? Head to the [Get Started](./get-started) guide.
