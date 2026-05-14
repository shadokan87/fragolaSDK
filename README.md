# Fragola Agentic SDK

<p align="center">
  <img src="./social-preview.png" alt="Fragola Agentic SDK splash" width="720" />
</p>

Fragola is an event‑driven SDK for building AI‑first software and custom agents. It focuses on composable primitives, predictable state, and production‑ready patterns for orchestrating AI tools and workflows.

> Status: **Under construction 🚧** – first public beta releases coming soon. 🧪

- 🌐 Website: https://fragola.ai
- 📚 Docs: https://docs.fragola.ai

## Key Features

- [x] **⚙️ Core primitives:** Define agents, tools, events, and state transitions as first‑class building blocks instead of ad‑hoc prompts and handlers.
- [x] **📡 Event‑driven model:** Drive your agents through explicit events (user messages, tool results, system triggers) for easier debugging and observability.
- [x] **🧩 Lightweight and extensible:** Bring only what you need; extend primitives to match your product’s architecture and domain.
- [x] **🏭 Production‑ready focus:** Built for long‑running agents, real‑world error handling, and integration into existing backends and UIs.

## Built‑in Hook Presets 🔌

Fragola ships with ready‑made “hook presets” for common patterns:

- **`mcpClient`:** Connect to remote or local MCP servers and expose their tools to your agents.
- **`orchestration`:** Coordinate multiple specialized agents that can communicate and collaborate on a task.
- **`guardrail`:** Validate user messages against unwanted or unsafe content and reject them with a clear reason.
- **`fileSystemSave`:** Persist conversations and state to the filesystem on Node.js‑like runtimes.

## Getting Started 📦


The SDK is not yet publicly released. We’re finalizing APIs and examples and will publish:

- An installable package: `@fragola-ai/agent`
- Full quickstart guides and recipes
- Integration examples for popular runtimes and frameworks


### Quickstart Example

Install the SDK:

```bash
npm install @fragola-ai/agent
```

Create a simple agent that responds to user messages:

```typescript
import { Fragola } from "@fragola-ai/agent";

const fragola = new Fragola({
	apiKey: process.env.OPENAI_API_KEY, // Can also be set in your environment
	model: "gpt-4o-mini"
});

const agent = fragola.agent({
	name: "QuickstartAgent",
	description: "My first Fragola agent",
	instructions: "You are a helpful and concise assistant."
});

const state = await agent.userMessage({
	content: "Hello! What can you do?"
});

console.log(state.messages); // Full conversation history
```