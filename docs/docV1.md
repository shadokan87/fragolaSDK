I’ll map your SDK’s actual features (events, hooks, metadata, store, presets like MCP and file save, streaming, tooling) into a clear documentation IA and explain what to put in each section.

High-level plan:
- Summarize what’s in the repo (features and focal points) based on source and tests.
- Propose a docs tree tailored to those features.
- Explain the content for every page (no code).
- Add recommendations for automation and maintenance.

## What I found in your package (at a glance)
- Core: Fragola instance that creates Agents; uses native OpenAI types; convenience helpers (e.g., boolean/json); exports utilities to strip metadata.
- Agent: Lifecycle with stateful conversation, streaming support, forks, tools, and model settings overrides.
- Tools: First-class tools with schema validation (Zod and stringified JSON schemas), dynamic tools updates at runtime.
- Events: Rich event system: model invocation, tool call, user/assistant messages, and “after” message updates; callback shapes and results management.
- Hooks: Plug-in style middleware with presets (e.g., MCP client, filesystem persistence), serialized init to prepare tools before generation.
- Metadata: Strongly-typed message metadata; utilities to strip meta from messages and conversation.
- Store: Global and per-agent namespaced stores with runtime add/remove; AgentContext orchestrates access and updates.
- Orchestration/Sub-agents: Mentioned and supported by design (descriptions, hooks, and events).
- Tests: Cover stores, dynamic tools, streaming behavior, and schema validation.

## Recommended documentation structure (README-style)

- Overview
  - What Fragola is, who it’s for, core philosophy (use native OpenAI types, event-driven, extensible hooks).
  - When to use Fragola vs alternatives.
  - Quick links to Get Started, Guides, and Reference.

- Get Started
  - Installation
    - Package manager commands (organized in tabs).
    - Minimum supported Node/runtime and environment variables.
  - Quickstart
    - Minimal flow from creating a client to sending a message and inspecting state.
    - Where to go next (Core Concepts).

- Core Concepts
  - Agents
    - Agent lifecycle and responsibilities.
    - Inputs/outputs at a high level (messages in/out, state updates, tools).
    - Forking/cloning behavior and when to use it.
  - Conversations and State
    - Conversation as native OpenAI types.
    - How conversation evolves; partial vs final assistant messages (streaming).
    - State mutations and reasons for updates (ties to “after” events).
  - Tools
    - Tool purpose and shape (name/description/schema).
    - Schemas with Zod vs JSON strings (validation strategies).
    - Tool execution results and how they affect conversation.
  - Events
    - Types of events (model invocation, tool call, user/assistant message, “after” updates).
    - When they fire and what you can influence (pre/post behaviors).
    - Typical use cases (observability, mutation, guardrails).
  - Hooks
    - What a hook is and how it composes.
    - Execution order and serialized initialization.
    - When to prefer a hook vs an event callback.
  - Metadata
    - What metadata is and where it lives.
    - Common metadata patterns (e.g., tagging messages, routing hints).
    - Stripping metadata utilities and why you’d use them.
  - Stores and Agent Context
    - Global vs namespaced per-agent stores.
    - Adding/removing stores safely; best practices to avoid collisions.
    - Using context for tools/events to read/write shared state.
  - Model Settings and Streaming
    - Overriding model settings per call vs defaults.
    - Streaming semantics and partial vs final message handling.
    - Prefer-tool-calling and JSON extraction behaviors (at a conceptual level).
  - Errors and Edge Cases
    - Validation failures (tool schemas).
    - Token/mode constraints and typical misconfigurations.
    - Guard patterns for robust production use.

- Guides
  - Build your first Agent
    - Walkthrough of setting up an agent, sending a message, and inspecting results.
    - Variation: streaming run with partials leading to final output.
  - Add Tools with Schemas
    - Designing tool contracts and choosing validation (Zod vs JSON schema).
    - Practical validation strategies and error messaging.
  - Update Tools at Runtime
    - When and why to add/remove/replace tools during the agent’s lifecycle.
    - Safe patterns for dynamic capabilities.
  - Use the Event System
    - Instrumentation use cases: analytics, logging, mutation hooks.
    - Shaping calls with modelInvocation; responding to tool calls; reacting to messages.
  - Build and Use Hooks
    - Encapsulate reusable behaviors in hooks.
    - Composing multiple hooks in larger apps.
  - Persist Conversations
    - Persistence patterns; when to persist (on “after” events).
    - Using filesystem persistence preset conceptually (what it achieves).
  - Integrate MCP
    - What MCP brings; how the client preset conceptually connects to agent tools and calls.
    - Reliability and security considerations.
  - Orchestration and Sub-agents
    - Designing multi-agent flows (task routing, specialization).
    - Control points: events vs hooks vs shared stores.
  - JSON Extraction Strategies
    - When to prefer tool calling versus response formats; trade-offs and reliability.
  - Testing and CI
    - How to structure tests around agents, tools, and events.
    - Mocking versus real calls; controlling cost and determinism.

- Presets
  - Hook Presets
    - Filesystem persistence: what it does, when to use it, limitations.
    - MCP client: what it does, supported scenarios, and expected environment.
    - Space for additional presets (orchestration, sub-agents, browser automation).

- Reference
  - Fragola (Client)
    - Responsibilities, options, and exposed helpers.
  - Agent
    - Options and behaviors; lifecycle; high-level method overview and parameters.
  - Agent Context
    - Store access; message and tools mutation hooks; intended usage.
  - Store
    - Namespacing, add/remove semantics; best practices.
  - Tool
    - Properties, schema strategies, and expected outputs conceptually.
  - Events
    - Event IDs, callback signatures in words, expected side effects.
  - Hooks
    - Hook signature and lifecycle described; composition rules and guarantees.
  - Types and Metadata
    - Message types, metadata shape, and utility functions explained at a high level.
  - Exceptions
    - Common error types and when they occur (usage errors, schema failures).
  - Vendor
    - OpenAI-specific notes; environment; rate limiting considerations.

- Examples
  - Minimal agent with a simple flow.
  - Tool-calling agent for a CRUD-style task.
  - Streaming interactions and partials.
  - Orchestration pattern with sub-agents.
  - MCP integration scenario.
  - Persistence with a preset.

- Advanced
  - Observability and Analytics
    - Using events for tracing and metrics; correlating with logs.
  - Performance and Cost Control
    - Prompt shaping, tool strategy, chunk processing; timeouts and retries.
  - Security and Safety
    - Validating tool inputs, content filtering strategies, and sandboxing.

- Migration & Versioning
  - Notable changes across versions and migration steps.
  - Deprecations and forward-compatibility tips.

- FAQ and Troubleshooting
  - Common pitfalls (schema mismatches, store namespacing issues, streaming assumptions).
  - Step-by-step checklists for resolving issues.

- Contributing
  - How to run tests locally; style and commit conventions; how to propose new presets.

## Suggested directory layout under docs
- index.mdx
- get-started/
  - installation.mdx
  - quickstart.mdx
- core/
  - agents.mdx
  - conversations-and-state.mdx
  - tools.mdx
  - events-and-context.mdx
  - hooks.mdx
  - metadata.mdx
  - stores.mdx
  - model-settings-and-streaming.mdx
  - errors.mdx
- guides/
  - building-an-agent.mdx
  - add-tools-with-schemas.mdx
  - dynamic-tools.mdx
  - use-the-event-system.mdx
  - build-and-use-hooks.mdx
  - persist-conversations.mdx
  - integrate-mcp.mdx
  - orchestration-and-subagents.mdx
  - json-extraction-strategies.mdx
  - testing-and-ci.mdx
- presets/
  - hook-presets.mdx
- reference/
  - fragola.mdx
  - agent.mdx
  - agent-context.mdx
  - store.mdx
  - tool.mdx
  - events.mdx
  - hooks.mdx
  - types-and-metadata.mdx
  - exceptions.mdx
  - vendor-openai.mdx
- examples/
  - minimal-agent.mdx
  - tool-calling.mdx
  - streaming.mdx
  - orchestration.mdx
  - mcp-integration.mdx
  - persistence.mdx
- advanced/
  - observability-and-analytics.mdx
  - performance-and-cost.mdx
  - security-and-safety.mdx
- migration-and-versioning.mdx
- faq-and-troubleshooting.mdx
- contributing.mdx

## Notes on content emphasis (based on your code/tests)
- Events: Provide a matrix of when each event triggers and what you can change or observe; add real-world scenarios (sanitization, A/B prompts, feature flags for tool selection).
- Tools: Contrast Zod vs stringified JSON schemas conceptually (trade-offs in validation and tooling).
- Stores: Stress namespacing best practices and failure modes (duplicate/missing namespace).
- Hooks: Clarify the order of hook init and its impact on readiness (e.g., tools registered by hooks).
- Streaming: Explain partial vs final semantics and when downstream consumers should wait for final state.
- Metadata: Show how metadata propagates conceptually and when to strip it.

## Recommended automation and maintenance
- API Reference generation: Use a typed API doc generator to keep the Reference section current. Publish into a dedicated `reference/` folder and link from the sidebar.
- Doc validation: Add a types check that runs MDX pre-processing and a build to ensure examples and links remain valid.
- Examples as tests: Keep example “scenarios” close to tested paths to reduce drift; consider deriving doc snippets from test fixtures where feasible.
- Versioning: If you plan breaking changes, pre-wire doc versioning (Fumadocs supports structuring content for versions).
- Release notes → Changelog: Automate changelog entries from commits/PR labels and reflect major docs updates in “Migration & Versioning”.

If you want, I can scaffold the folder structure with empty MDX pages and minimal frontmatter to get you moving fast—just say the word and I’ll create them.