# Fragola Tracing Specification (Draft)

## 1. Goals

Tracing should make it easy to:

- Understand what an agent is doing over time (inputs, tools, state changes, outputs).
- Debug and audit conversations and orchestration decisions.
- Feed structured traces to external systems (logs, observability, analytics, replay tools).
- Enable or disable tracing per agent / per run with minimal overhead.
- Plug in multiple backends (console, file, HTTP, OpenTelemetry, custom).

The design should:

- Be **non-intrusive** for existing agents and hooks.
- Be **composable**: multiple hooks can emit trace events.
- Be **typed**: events are strongly typed and versioned.
- Be **transport-agnostic**: core API only knows about events, not where they go.

---

## 2. Core Concepts

### 2.1 Trace Context

A `TraceContext` identifies a logical execution flow within the system.

- `traceId`: Stable across the whole agent run (conversation / orchestration run).
- `spanId`: Identifies a specific operation within the trace (tool call, hook, step).
- `parentSpanId`: Optional parent for hierarchical traces.
- `timestamp`: ISO timestamp for when an event occurs.

```ts
export type TraceId = string;
export type SpanId = string;

export interface TraceContext {
  traceId: TraceId;
  spanId: SpanId;
  parentSpanId?: SpanId;
  timestamp: string; // ISO 8601
}
```

### 2.2 Trace Event

Every traced action in Fragola emits a `TraceEvent` with:

- A **category** (conversation, tool, state, hook, error, system).
- A more specific **type** (e.g. `conversation.start`, `tool.end`).
- A **payload** specific to that event type.

```ts
export type TraceEventCategory =
  | "conversation"
  | "tool"
  | "state"
  | "hook"
  | "system"
  | "error";

export interface BaseTraceEvent<P = unknown> {
  context: TraceContext;
  category: TraceEventCategory;
  type: string; // e.g. "conversation.start", "tool.end"
  payload: P;
  tags?: Record<string, string | number | boolean>;
  // optional correlation IDs (requestId, runId, etc.)
  correlation?: Record<string, string | number>;
}
```

---

## 3. Event Types

Below is a **proposed** event taxonomy. It should be kept small and useful.

### 3.1 Conversation Events

- `conversation.start`
- `conversation.step`
- `conversation.end`

```ts
export interface ConversationStartPayload {
  agentName: string;
  runId: string; // logical run/execution id
  inputMessages: unknown[]; // normalized message format
}

export interface ConversationStepPayload {
  runId: string;
  stepIndex: number;
  userMessage?: unknown;
  modelMessage?: unknown;
}

export interface ConversationEndPayload {
  runId: string;
  status: "success" | "error" | "cancelled";
  errorMessage?: string;
}
```

### 3.2 Tool Events

- `tool.discovered` – tool is registered/updated in the context.
- `tool.start` – a tool invocation begins.
- `tool.end` – a tool invocation finishes.
- `tool.error` – a tool invocation failed.

```ts
export interface ToolDiscoveredPayload {
  toolName: string;
  description?: string;
  source: "local" | "mcp" | "plugin";
}

export interface ToolStartPayload {
  runId: string;
  toolName: string;
  input: unknown;
}

export interface ToolEndPayload {
  runId: string;
  toolName: string;
  input: unknown;
  output: unknown;
  durationMs: number;
}

export interface ToolErrorPayload {
  runId: string;
  toolName: string;
  input: unknown;
  errorMessage: string;
  stack?: string;
}
```

### 3.3 State Events

Events about internal agent state / stores.

- `state.init` – store created or attached.
- `state.update` – store value changed.

```ts
export interface StateInitPayload {
  storeNamespace: string;
  initialValue: unknown;
}

export interface StateUpdatePayload {
  storeNamespace: string;
  patch: unknown; // implementation-specific diff, or full snapshot
}
```

### 3.4 Hook Events

- `hook.start` – a hook begins processing an agent.
- `hook.end` – a hook completes.
- `hook.error` – hook threw or rejected.

```ts
export interface HookStartPayload {
  hookName: string;
}

export interface HookEndPayload {
  hookName: string;
}

export interface HookErrorPayload {
  hookName: string;
  errorMessage: string;
  stack?: string;
}
```

### 3.5 System / Error Events

For unexpected failures or infrastructure-level issues.

```ts
export interface SystemErrorPayload {
  scope: "agent" | "tool" | "transport" | "hook" | "store";
  message: string;
  stack?: string;
}
```

---

## 4. Tracer Interface

The core tracing API is a simple interface that can be passed into the agent and reused by hooks.

```ts
export interface Tracer {
  // Fire-and-forget event
  emit<E extends BaseTraceEvent>(event: E): void;

  // Optional helper to derive a new span from an existing context
  childSpan(parent: TraceContext, spanName?: string): TraceContext;
}
```

### 4.1 No-Op Tracer

Default implementation that does nothing, used when tracing is disabled.

```ts
export const noopTracer: Tracer = {
  emit() {},
  childSpan(parent) {
    return { ...parent, spanId: parent.spanId };
  }
};
```

---

## 5. Agent-Level Integration

### 5.1 Agent Options

Agents (and orchestration) accept an optional tracer.

```ts
export interface AgentRunOptions {
  tracer?: Tracer;
  traceId?: TraceId; // optional override
}
```

When a run starts:

- If `traceId` is provided, use it; otherwise generate one.
- Create a root `TraceContext` with a new `spanId`.
- Emit `conversation.start` with that context.

### 5.2 Tool Wrapping

When a tool is invoked via the agent:

1. Create a child span from the current context.
2. Emit `tool.start`.
3. Time the execution.
4. On success: emit `tool.end`.
5. On error: emit `tool.error`.

Pseudo-code:

```ts
async function invokeTool(toolName: string, input: unknown, ctx: TraceContext, tracer?: Tracer) {
  const span = tracer?.childSpan(ctx, `tool:${toolName}`) ?? ctx;

  const startEvent: BaseTraceEvent<ToolStartPayload> = {
    context: span,
    category: "tool",
    type: "tool.start",
    payload: { runId: ctx.traceId, toolName, input }
  };
  tracer?.emit(startEvent);

  const started = Date.now();
  try {
    const output = await actuallyCallTool(toolName, input);

    const endEvent: BaseTraceEvent<ToolEndPayload> = {
      context: span,
      category: "tool",
      type: "tool.end",
      payload: {
        runId: ctx.traceId,
        toolName,
        input,
        output,
        durationMs: Date.now() - started
      }
    };
    tracer?.emit(endEvent);

    return output;
  } catch (err: any) {
    const errorEvent: BaseTraceEvent<ToolErrorPayload> = {
      context: span,
      category: "tool",
      type: "tool.error",
      payload: {
        runId: ctx.traceId,
        toolName,
        input,
        errorMessage: String(err?.message ?? err),
        stack: err?.stack
      }
    };
    tracer?.emit(errorEvent);
    throw err;
  }
}
```

---

## 6. Hook-Level Integration

Hooks like `mcpClient` can accept the tracer via the agent context (or props) and emit events:

- `hook.start` / `hook.end` when the hook is applied.
- `tool.discovered` when MCP tools are synced.
- `state.init` when a new store namespace is created.
- `state.update` when resources/prompts maps change.

Example (conceptual):

```ts
// Inside a hook
const tracer = agent.context.tracer; // or from options

tracer?.emit< BaseTraceEvent<HookStartPayload> >({
  context: rootContext,
  category: "hook",
  type: "hook.start",
  payload: { hookName: "mcpClient" }
});
```

---

## 7. Transports / Backends

The core `Tracer` is abstract. Concrete implementations can:

### 7.1 ConsoleTracer

- Logs events to `console.debug`/`console.log` in a compact JSON format.

```ts
export class ConsoleTracer implements Tracer {
  emit(event: BaseTraceEvent) {
    // You may want to strip large payloads
    console.debug("[TRACE]", JSON.stringify(event));
  }

  childSpan(parent: TraceContext, spanName?: string): TraceContext {
    return {
      ...parent,
      spanId: `${parent.spanId}:${spanName ?? Math.random().toString(16).slice(2)}`,
      timestamp: new Date().toISOString()
    };
  }
}
```

### 7.2 HttpTracer

- Sends batches of events to a remote collector via HTTP.

```ts
export class HttpTracer implements Tracer {
  constructor(private endpoint: string) {}

  emit(event: BaseTraceEvent) {
    // fire-and-forget; in real impl you would batch + retry
    fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event)
    }).catch(() => {});
  }

  childSpan(parent: TraceContext, spanName?: string): TraceContext {
    return {
      ...parent,
      spanId: `${parent.spanId}:${spanName ?? Math.random().toString(16).slice(2)}`,
      timestamp: new Date().toISOString()
    };
  }
}
```

### 7.3 OpenTelemetryTracer (future)

- Optional integration that maps `TraceEvent` to OpenTelemetry spans/events.
- Out of scope for this initial spec but should be achievable via an adapter.

---

## 8. Configuration Examples

### 8.1 Enable tracing on an agent run

```ts
import { ConsoleTracer } from "./tracing";

const tracer = new ConsoleTracer();

const result = await agent.run({
  input: userInput,
  tracer,
  traceId: "run-1234"
});
```

### 8.2 Pass tracer to hooks

Hooks do **not** own tracing, but they can use an agent-level tracer:

```ts
const tracer = new ConsoleTracer();

const agent = createAgent({
  hooks: [
    mcpClient({ client: { name: "mcp", url: "http://localhost:3000/mcp" } }),
    // other hooks
  ],
  tracer
});
```

The concrete wiring depends on how Fragola exposes agent context; the important part is that:

- There is a **single shared tracer** per run.
- Hooks can safely emit events via that tracer.

---

## 9. Non-Goals / Out of Scope (for now)

- Full OpenTelemetry semantic conventions.
- Persisted trace storage or query UI.
- Automatic PII scrubbing (can be added later via a pre-processing step on events).

---

## 10. Next Steps

1. Finalize the minimal event set (keep it small but useful).
2. Implement `Tracer` and a `ConsoleTracer` in the core package.
3. Thread `tracer` through agent runs and contexts.
4. Emit basic events from:
   - Agent lifecycle (start/end).
   - Tool invocations.
   - Stores (init/update).
   - Key hooks (e.g. `mcpClient`).
5. Add a small example in `README.md` and/or `docs/` showing how to enable and consume traces.
