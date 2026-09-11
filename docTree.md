# Fragola SDK — Documentation Sidebar Tree Plan

This document outlines the structure and sections for the left-hand navigation sidebar of the Fragola documentation.

---

## 1. Introduction
- [x] **Overview & Philosophy**
  - [x] Introduction to Fragola (Event-driven AI agent SDK)
  - [x] Why Fragola? (Predictable state, minimal building blocks, extensible hooks)
  - [x] Architecture at a Glance
- [x] **Installation & Setup**
  - [x] Package installation (`@fragola-ai/agent`)
  - [x] Client configuration (OpenAI API key, baseURL, custom SDK instances)
  - [x] Environment requirements & TypeScript configuration
- [x] **Quickstart**
  - [x] Creating your first agent
  - [x] Sending user messages (`userMessage`)
  - [x] Inspecting state & conversation history
- [x] **Core Concepts**
  - [x] Agents & Execution Turns
  - [x] Events & Lifecycle Pipeline
  - [x] Agent Context & Instructions
  - [x] Stores & State Management
  - [x] Hooks & Plugins

---

## 2. Agents & Execution
- [x] **Creating & Configuring Agents**
  - [x] `fragola.agent(...)` options (`name`, `description`, `instructions`, `useDeveloperRole`)
  - [x] Model settings (`model`, `temperature`, parameters)
  - [x] Seeding initial messages history
- [x] **Execution & Stepping**
  - [x] `agent.userMessage(...)` (Single turn with user prompt)
  - [x] Multi-part user messages (Text, images, attachments)
  - [x] `agent.step(...)` (Executing steps without adding user messages)
  - [x] Step options (`maxStep`, `by`, `resetStepCountAfterUserMessage`, runtime overrides)
- [x] **Structured Outputs (`agent.json`)**
  - [x] Using Zod schemas for structured responses
  - [x] Handling JSON validation results (`success`, `data`, `error`)
  - [x] Bypassing user message events (`ignoreUserMessageEvents`)
  - [x] Error handling with `JsonModeError`
- [x] **State & Lifecycle Management**
  - [x] Agent state object (`messages`, `stepCount`, `status`)
  - [x] Status transitions (`idle` ↔ `generating` ↔ `waiting`)
  - [x] Resetting agents (`agent.reset()`, `agent.resetStepCount()`)
  - [x] Stopping executions (`agent.stop()`, `agent.stopSync()`)
- [x] **Agent Forking (`agent.fork`)**
  - [x] Forking concept & branching conversations
  - [x] State, stores, and hooks inheritance
  - [x] Isolated execution & fork hierarchy (`agent.forkOf`)

---

## 3. Tools & Function Calling
- [x] **Defining Tools**
  - [x] `tool(...)` helper function
  - [x] Tool metadata (`name`, `description`)
  - [x] Tool handlers (`handler: (params, context) => ...`)
- [x] **Schema & Validation**
  - [x] Zod schema validation (Zod v3 & v4 support)
  - [x] Raw JSON schema string definitions
  - [x] Validation errors & automatic reporting to the model
- [x] **Dynamic Tools & Custom Resolution**
  - [x] `handler: "dynamic"` for server-side / proxy delegation
  - [x] Injecting results in `onBeforeToolCall`
- [x] **Runtime Tool Management**
  - [x] Updating agent tools dynamically (`context.updateTools`)
  - [x] Enabling/disabling tools per step

---

## 4. Events
- [x] **Event System Overview**
  - [x] Event pipeline & execution order
  - [x] Registering event handlers (`on`, `watch`, inline methods)
  - [x] Flow control: `stop()` and `stopSync()`
  - [x] **User Message Lifecycle**
    - [x] `onUserMessage` (Intercepting, enriching, or transforming user input)
  - [x] **Step Lifecycle**
    - [x] `onBeforeStep` (Modifying step parameters before turn starts)
    - [x] `onAfterStep` (Inspecting results, new messages, steps taken, or errors)
  - [x] **Model Invocation Lifecycle**
    - [x] `onBeforeModelInvocation` (Overriding model settings, `injectMessage`, `injectResponse`)
    - [x] `onModelInvocation` (Chunk-level stream manipulation, delta injection, chunk merge patches)
    - [x] `onAiMessage` (Transforming partial/final assistant messages)
    - [x] `onAfterModelInvocation` (Inspecting assistant message, `finish_reason`, and token `usage`)
  - [x] **Tool Call Lifecycle**
    - [x] `onBeforeToolCall` (Parameter rewriting, injecting tool responses via `injectConfig`)
    - [x] `onToolCall` (Transforming tool outputs before appending to history)
    - [x] `onAfterToolCall` (Tool execution post-processing and logging)
- [x] **State Watchers**
  - [x] `watchState` (Reactive state observation for UI, metrics, and logging)

---

## 5. Agent Context
- [x] **Understanding `AgentContext`**
  - [x] Context availability in tools, events, and hooks
  - [x] Accessing agent state & options
  - [x] Accessing parent SDK instance
- [x] **Dynamic & Scoped Instructions**
  - [x] Global instructions vs scoped instructions
  - [x] `context.setInstructions(instructions, scope?)`
  - [x] `context.instructions(scope?)` (Reading single scope or merged `'*'`)
  - [x] `context.removeInstructions(scope)`
- [x] **Message History Manipulation**
  - [x] `context.raw.updateMessages(...)` (Custom message mutations)
  - [x] `context.messagesParser` utilities
- [x] **Runtime Agent Mutation**
  - [x] Dynamic options update (`context.setOptions`)
  - [x] Tool updates (`context.updateTools`)
  - [x] Controlled early exits (`context.stop()`, `context.stopSync()`)

---

## 6. State & Stores
- [x] **Store Primitives**
  - [x] Creating stores (`createStore(initialValue, scope?)`)
  - [x] Reactive state updates and subscribers (`store.subscribe`, `store.set`, `store.update`)
- [x] **Local Stores**
  - [x] Attaching agent-scoped stores via `fragola.agent({ store, ... })`
  - [x] Accessing store via `context.store`
- [x] **Global Stores**
  - [x] Sharing state across all agents via `new Fragola({ store, ... })`
  - [x] Accessing global store in context
- [x] **Scoped Stores**
  - [x] Registering multiple stores (`context.addStore`)
  - [x] Querying scoped stores (`context.getStore("scope")`)
  - [x] Removing stores (`context.removeStore`)
- [x] **Message Metadata Typing**
  - [x] Defining type-safe metadata with `DefineMetaData<{ user, ai, tool }>`
  - [x] Accessing `message.meta`
  - [x] Stripping metadata before LLM calls (`stripMeta`, `stripMessagesMeta`)

---

## 7. Hooks & Extensibility
- [x] **Hook System Overview**
  - [x] The Hook concept (`Hook(...)`, `FragolaHook`)
  - [x] Reusable behaviors, logging, and third-party integrations
- [x] **Creating Custom Hooks**
  - [x] Writing synchronous and asynchronous hooks
  - [x] Subscribing to events within hooks
  - [x] Teardown logic: returning a disposal function (`FragolaHookDispose`)
- [x] **Managing Hooks on Agents**
  - [x] Registering hooks (`agent.use(hook, name?)`)
  - [x] Checking hook presence (`agent.hasHook(name)`)
  - [x] Removing named hooks (`agent.removeHook(name)`)
  - [x] Disposing all agent hooks (`agent.dispose()`)
  - [x] Waiting for async hook initialization (`agent.init()`)
- [x] **Hook Scoping & Lifecycle**
  - [x] Automatic cleanup of hook-registered events upon removal
  - [x] Hook preservation during agent forking

---

## 8. Built-in Hook Presets
- [ ] **MCP Client Preset (`mcp-client`)**
  - [ ] What is Model Context Protocol (MCP)?
  - [ ] Connecting to local STDIO and remote SSE MCP servers
  - [ ] Auto-registering MCP tools to Fragola agents
  - [ ] Configuration options & error recovery
- [ ] **Orchestration Preset (`orchestration`)**
  - [ ] Multi-agent patterns (Delegation, routing, collaboration)
  - [ ] Registering sub-agents as tools
  - [ ] Context passing and shared conversation memory between agents
- [ ] **Guardrail Preset (`guardrail`)**
  - [ ] Input moderation and safety policies
  - [ ] Rejecting or sanitizing unsafe user messages
  - [ ] Custom validation rules & response strategies
- [ ] **Human-In-The-Loop Preset (`HITL`)**
  - [ ] Pausing execution for human authorization
  - [ ] Tool call approval & rejection workflows
  - [ ] Resuming agent turns after user feedback

---

## 9. Error Handling & Troubleshooting
- [ ] **Error Hierarchy & Exceptions**
  - [ ] `FragolaError` (Base SDK error)
  - [ ] `BadUsage` (Invalid API usage, state conflicts)
  - [ ] `JsonModeError` (Structured output & schema parse failures)
  - [ ] `MaxStepHitError` (Loop prevention & max step breaches)
- [ ] **Tool Call Failures & Recovery**
  - [ ] Validation errors vs execution errors
  - [ ] Handling malformed JSON arguments from models
  - [ ] Responding with informative error payloads
- [ ] **Debugging & Tracing**
  - [ ] Inspecting state transitions with `watchState`
  - [ ] Logging chunks & model payloads with `ModelInvocation` events

---

## 10. TypeScript & Generics Guide
- [x] **Generic Parameters Reference**
  - [x] `TMetaData` (Message metadata definitions)
  - [x] `TGlobalStore` (Global store state type)
  - [x] `TStore` (Local agent store state type)
- [x] **Tool Parameter & Return Types**
  - [x] Type inference with `Infer<TSchema>`
  - [x] Handler return types (`ToolHandlerReturnType`)
- [x] **Typing Hooks & Contexts**
  - [x] Using `AgentAny` for generalized hooks
  - [x] Strictly typed hooks with explicit agent generics

---

## 11. API Reference
- [x] **`Fragola` Class**
  - [x] `constructor(options)`
  - [x] `fragola.agent(options)`
  - [x] `fragola.store`
- [x] **`Agent` Class**
  - [x] Properties (`id`, `state`, `options`, `context`, `forkOf`)
  - [x] Execution methods (`userMessage`, `step`, `json`, `reset`, `stop`, `stopSync`, `fork`)
  - [x] Event methods (`on`, `watch`, `watchState`, `onUserMessage`, `onBeforeStep`, `onAfterStep`, `onBeforeModelInvocation`, `onModelInvocation`, `onAiMessage`, `onAfterModelInvocation`, `onBeforeToolCall`, `onToolCall`, `onAfterToolCall`)
  - [x] Hook methods (`use`, `hasHook`, `removeHook`, `dispose`, `init`)
- [x] **`AgentContext` Class**
  - [x] Properties (`state`, `options`, `store`, `systemPrompt`, `instance`, `messagesParser`, `raw`)
  - [x] Methods (`instructions`, `setInstructions`, `removeInstructions`, `getStore`, `addStore`, `removeStore`, `setOptions`, `updateTools`, `stop`, `stopSync`)
- [ ] **Events & Payloads**
  - [ ] Default event payloads (`EventUserMessagePayload`, `EventModelInvocationPayload`, `EventAiMessagePayload`, `EventToolCallPayload`)
  - [ ] Before event payloads (`EventBeforeStepPayload`, `EventBeforeModelInvocationPayload`, `EventBeforeToolCallPayload`)
  - [ ] After event payloads (`EventAfterStepPayload`, `EventAfterModelInvocationPayload`, `EventAfterToolCallPayload`)
- [ ] **Store & Utility Functions**
  - [ ] `createStore`, `tool`, `Hook`, `messagesUtils`, `stripMeta`, `stripMessagesMeta`
