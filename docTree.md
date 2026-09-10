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
- [ ] **Creating & Configuring Agents**
  - [ ] `fragola.agent(...)` options (`name`, `description`, `instructions`, `useDeveloperRole`)
  - [ ] Model settings (`model`, `temperature`, parameters)
  - [ ] Seeding initial messages history
- [ ] **Execution & Stepping**
  - [ ] `agent.userMessage(...)` (Single turn with user prompt)
  - [ ] Multi-part user messages (Text, images, attachments)
  - [ ] `agent.step(...)` (Executing steps without adding user messages)
  - [ ] Step options (`maxStep`, `by`, `resetStepCountAfterUserMessage`, runtime overrides)
- [ ] **Structured Outputs (`agent.json`)**
  - [ ] Using Zod schemas for structured responses
  - [ ] Handling JSON validation results (`success`, `data`, `error`)
  - [ ] Bypassing user message events (`ignoreUserMessageEvents`)
  - [ ] Error handling with `JsonModeError`
- [ ] **State & Lifecycle Management**
  - [ ] Agent state object (`messages`, `stepCount`, `status`)
  - [ ] Status transitions (`idle` ↔ `generating` ↔ `waiting`)
  - [ ] Resetting agents (`agent.reset()`, `agent.resetStepCount()`)
  - [ ] Stopping executions (`agent.stop()`, `agent.stopSync()`)
- [ ] **Agent Forking (`agent.fork`)**
  - [ ] Forking concept & branching conversations
  - [ ] State, stores, and hooks inheritance
  - [ ] Isolated execution & fork hierarchy (`agent.forkOf`)

---

## 3. Tools & Function Calling
- [ ] **Defining Tools**
  - [ ] `tool(...)` helper function
  - [ ] Tool metadata (`name`, `description`)
  - [ ] Tool handlers (`handler: (params, context) => ...`)
- [ ] **Schema & Validation**
  - [ ] Zod schema validation (Zod v3 & v4 support)
  - [ ] Raw JSON schema string definitions
  - [ ] Validation errors & automatic reporting to the model
- [ ] **Dynamic Tools & Custom Resolution**
  - [ ] `handler: "dynamic"` for server-side / proxy delegation
  - [ ] Injecting results in `onBeforeToolCall`
- [ ] **Runtime Tool Management**
  - [ ] Updating agent tools dynamically (`context.updateTools`)
  - [ ] Enabling/disabling tools per step

---

## 4. Event System & Lifecycle
- [ ] **Event System Overview**
  - [ ] Event pipeline & execution order
  - [ ] Registering event handlers (`on`, `watch`, inline methods)
  - [ ] Flow control: `stop()` and `stopSync()`
- [ ] **User Message Lifecycle**
  - [ ] `onUserMessage` (Intercepting, enriching, or transforming user input)
- [ ] **Step Lifecycle**
  - [ ] `onBeforeStep` (Modifying step parameters before turn starts)
  - [ ] `onAfterStep` (Inspecting results, new messages, steps taken, or errors)
- [ ] **Model Invocation Lifecycle**
  - [ ] `onBeforeModelInvocation` (Overriding model settings, `injectMessage`, `injectResponse`)
  - [ ] `onModelInvocation` (Chunk-level stream manipulation, delta injection, chunk merge patches)
  - [ ] `onAiMessage` (Transforming partial/final assistant messages)
  - [ ] `onAfterModelInvocation` (Inspecting assistant message, `finish_reason`, and token `usage`)
- [ ] **Tool Call Lifecycle**
  - [ ] `onBeforeToolCall` (Parameter rewriting, injecting tool responses via `injectConfig`)
  - [ ] `onToolCall` (Transforming tool outputs before appending to history)
  - [ ] `onAfterToolCall` (Tool execution post-processing and logging)
- [ ] **State Watchers**
  - [ ] `watchState` (Reactive state observation for UI, metrics, and logging)

---

## 5. Agent Context
- [ ] **Understanding `AgentContext`**
  - [ ] Context availability in tools, events, and hooks
  - [ ] Accessing agent state & options
  - [ ] Accessing parent SDK instance
- [ ] **Dynamic & Scoped Instructions**
  - [ ] Global instructions vs scoped instructions
  - [ ] `context.setInstructions(instructions, scope?)`
  - [ ] `context.instructions(scope?)` (Reading single scope or merged `'*'`)
  - [ ] `context.removeInstructions(scope)`
- [ ] **Message History Manipulation**
  - [ ] `context.raw.updateMessages(...)` (Custom message mutations)
  - [ ] `context.messagesParser` utilities
- [ ] **Runtime Agent Mutation**
  - [ ] Dynamic options update (`context.setOptions`)
  - [ ] Tool updates (`context.updateTools`)
  - [ ] Controlled early exits (`context.stop()`, `context.stopSync()`)

---

## 6. State & Stores
- [ ] **Store Primitives**
  - [ ] Creating stores (`createStore(initialValue, scope?)`)
  - [ ] Reactive state updates and subscribers (`store.subscribe`, `store.set`, `store.update`)
- [ ] **Local Stores**
  - [ ] Attaching agent-scoped stores via `fragola.agent({ store, ... })`
  - [ ] Accessing store via `context.store`
- [ ] **Global Stores**
  - [ ] Sharing state across all agents via `new Fragola({ store, ... })`
  - [ ] Accessing global store in context
- [ ] **Scoped Stores**
  - [ ] Registering multiple stores (`context.addStore`)
  - [ ] Querying scoped stores (`context.getStore("scope")`)
  - [ ] Removing stores (`context.removeStore`)
- [ ] **Message Metadata Typing**
  - [ ] Defining type-safe metadata with `DefineMetaData<{ user, ai, tool }>`
  - [ ] Accessing `message.meta`
  - [ ] Stripping metadata before LLM calls (`stripMeta`, `stripMessagesMeta`)

---

## 7. Hooks & Extensibility
- [ ] **Hook System Overview**
  - [ ] The Hook concept (`Hook(...)`, `FragolaHook`)
  - [ ] Reusable behaviors, logging, and third-party integrations
- [ ] **Creating Custom Hooks**
  - [ ] Writing synchronous and asynchronous hooks
  - [ ] Subscribing to events within hooks
  - [ ] Teardown logic: returning a disposal function (`FragolaHookDispose`)
- [ ] **Managing Hooks on Agents**
  - [ ] Registering hooks (`agent.use(hook, name?)`)
  - [ ] Checking hook presence (`agent.hasHook(name)`)
  - [ ] Removing named hooks (`agent.removeHook(name)`)
  - [ ] Disposing all agent hooks (`agent.dispose()`)
  - [ ] Waiting for async hook initialization (`agent.init()`)
- [ ] **Hook Scoping & Lifecycle**
  - [ ] Automatic cleanup of hook-registered events upon removal
  - [ ] Hook preservation during agent forking

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
- [ ] **Generic Parameters Reference**
  - [ ] `TMetaData` (Message metadata definitions)
  - [ ] `TGlobalStore` (Global store state type)
  - [ ] `TStore` (Local agent store state type)
- [ ] **Tool Parameter & Return Types**
  - [ ] Type inference with `Infer<TSchema>`
  - [ ] Handler return types (`ToolHandlerReturnType`)
- [ ] **Typing Hooks & Contexts**
  - [ ] Using `AgentAny` for generalized hooks
  - [ ] Strictly typed hooks with explicit agent generics

---

## 11. API Reference
- [ ] **`Fragola` Class**
  - [ ] `constructor(options)`
  - [ ] `fragola.agent(options)`
  - [ ] `fragola.store`
- [ ] **`Agent` Class**
  - [ ] Properties (`id`, `state`, `options`, `context`, `forkOf`)
  - [ ] Execution methods (`userMessage`, `step`, `json`, `reset`, `stop`, `stopSync`, `fork`)
  - [ ] Event methods (`on`, `watch`, `watchState`, `onUserMessage`, `onBeforeStep`, `onAfterStep`, `onBeforeModelInvocation`, `onModelInvocation`, `onAiMessage`, `onAfterModelInvocation`, `onBeforeToolCall`, `onToolCall`, `onAfterToolCall`)
  - [ ] Hook methods (`use`, `hasHook`, `removeHook`, `dispose`, `init`)
- [ ] **`AgentContext` Class**
  - [ ] Properties (`state`, `options`, `store`, `systemPrompt`, `instance`, `messagesParser`, `raw`)
  - [ ] Methods (`instructions`, `setInstructions`, `removeInstructions`, `getStore`, `addStore`, `removeStore`, `setOptions`, `updateTools`, `stop`, `stopSync`)
- [ ] **Events & Payloads**
  - [ ] Default event payloads (`EventUserMessagePayload`, `EventModelInvocationPayload`, `EventAiMessagePayload`, `EventToolCallPayload`)
  - [ ] Before event payloads (`EventBeforeStepPayload`, `EventBeforeModelInvocationPayload`, `EventBeforeToolCallPayload`)
  - [ ] After event payloads (`EventAfterStepPayload`, `EventAfterModelInvocationPayload`, `EventAfterToolCallPayload`)
- [ ] **Store & Utility Functions**
  - [ ] `createStore`, `tool`, `Hook`, `messagesUtils`, `stripMeta`, `stripMessagesMeta`
