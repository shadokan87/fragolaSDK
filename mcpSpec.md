

Below is a detailed analysis and a concrete plan to add an MCP client feature into your `fragolaSDK`, leveraging the `@modelcontextprotocol/sdk` TypeScript client. I focus on: architectural fit, adapter patterns, lifecycle, event wiring, edge cases, and incremental implementation steps with suggested code scaffolds.

## High-level integration goal

Allow a `Fragola` `Agent` to seamlessly use remote MCP servers’ tools/resources/prompts as if they were native Fragola tools, while preserving your existing event system (`onToolCall`, `onModelInvocation`, etc.), stores, and orchestration hooks.

## Architectural Fit

Your current design cleanly separates:
- Conversation state (`Agent.state.conversation`)
- Tool abstraction (`Tool` objects with optional Zod schema)
- Event pipeline (model invocation, tool call, ai/user message transforms)
- Hooks (extensible behavior like orchestration)

MCP concepts map naturally:
- MCP Server Tools → Fragola `Tool` objects with a dynamic handler that delegates `client.callTool`.
- MCP Resources → Either:
  1. A “read_resource” dynamic tool (fetch by URI)
  2. Automatic pre-injection into conversation (more invasive; optional)
  3. Added to a namespaced store for contextual retrieval
- MCP Prompts → Tools that return structured prompt messages OR a helper that appends messages directly via `context.raw.appendMessages`.

Notifications (`listChanged`) → Refresh local cached remote tool list & auto-enable/disable mirrored Fragola tools.

## Proposed Modules / Features

1. `src/mcp/mcpClientManager.ts`
   - Wraps MCP `Client`
   - Handles transport selection (stdio vs Streamable HTTP + fallback to SSE)
   - Maintains cached lists: tools, resources, prompts
   - Emits internal events (simple `EventEmitter` or lightweight custom) on list changes

2. `src/mcp/adapters.ts`
   - `mcpToolToFragolaTool(mcpTool, client)` returns `Tool` with:
     - `name`: MCP tool name
     - `description`: derived from MCP config (use `getDisplayName` if useful)
     - `schema`: convert JSON Schema → Zod (best-effort; fallback to passthrough)  
   - `jsonSchemaToZod(schema)` partial converter (handle object, string, number, enum, array; mark unsupported types as `z.any()`)

3. Hook preset: `src/hook/presets/mcpBridge.ts`
   - Usage: `agent.use(mcpBridge({ clientManager, syncIntervalMs?, autoResources?, promptAsTool? }))`
   - On attach:
     - Fetch MCP lists → register mirrored tools via `agent.context.updateTools`
     - Optionally map resources/prompts
   - Subscribes to clientManager change events to re-sync without manual intervention
   - Optionally adds:
     - Tool `read_resource` with schema `{ uri: z.string() }`
     - Tool `use_prompt` with schema `{ name: z.string(), args: z.record(z.any()) }`

4. Optional `src/mcp/resourceStore.ts`
   - Namespaced store (e.g., `"mcpResources"`) holding metadata & last fetched content.

5. Error / retry layer:
   - Reconnect strategies
   - Graceful fallback if remote schema cannot be converted

## Lifecycle Flow

1. Initialize MCP Client:
   ```ts
   const manager = new McpClientManager({
     transport: { type: 'http', url: 'http://localhost:3000/mcp' },
     // or stdio: { type: 'stdio', command: 'node', args: ['server.js'] }
     clientInfo: { name: 'fragola-mcp-client', version: '1.0.0' }
   });
   await manager.connect();
   ```

2. Create Fragola agent; apply bridge:
   ```ts
   const fragola = new Fragola({ model: 'gpt-4.1-mini' });
   const agent = fragola.agent({
     name: 'MainAgent',
     instructions: 'You can use local and remote tools.',
     description: 'Agent with MCP integration.'
   }).use(mcpBridge({ clientManager: manager, autoResources: true, promptAsTool: true }));
   ```

3. When MCP lists change (server dynamic updates), the hook:
   - Computes diff
   - Updates `agent.context.updateTools(prev => merge(prev, remoteMappedTools))`
   - Optionally invalidates resource store entries

4. Tool invocation:
   - Remote tool mirrored as local Fragola `Tool` with handler:
     ```ts
     handler: async (params, context) => {
        return await manager.callTool(mcpTool.name, params);
     }
     ```
   - Result returned as stringified JSON (your existing type system expects a stringable output)

5. Resources & Prompts:
   - `read_resource`: dynamic calls `client.readResource({ uri })`, stores content, returns summary or full text.
   - `use_prompt`: fetches a prompt, appends its messages directly to conversation (via `context.raw.appendMessages([...])`) and returns a confirmation.

## Detailed Implementation Steps

1. Add dependency:
   ```json
   "@modelcontextprotocol/sdk": "^1.21.1"
   ```
2. Create directory `src/mcp/` and files:
   - `mcpClientManager.ts`
   - `adapters.ts`
   - `resourceStore.ts` (optional)
3. Implement `McpClientManager`:
   - Fields: `client`, `connected`, `toolCache`, `resourceCache`, `promptCache`
   - Methods:
     - `connect()`
     - `refreshAll()`
     - `listTools()`, `listResources()`, `listPrompts()`
     - `callTool(name, args)`
     - `readResource(uri)`
     - `getPrompt(name, arguments)`
     - `onListChanged(callback)`
   - Transport strategy:
     - Try `StreamableHTTPClientTransport`
     - On failure (4xx) fallback to `SSEClientTransport`
     - Optionally support `StdioClientTransport`
4. Create `adapters.ts` with:
   - `jsonSchemaToZod(schema)` partial translator
   - `mcpToolToFragolaTool(mcpTool, clientManager)`
5. Add hook preset `mcpBridge.ts`:
   - Accept config options
   - On mount:
     - Await `clientManager.refreshAll()`
     - Convert each remote MCP tool → Fragola tool
     - Register internal bridging tools (read/use prompt) if enabled
     - Setup listener for cache invalidation
6. Add namespaced resource store:
   - `fragola.addStore(createStore({ resources: {} }, "mcpResources"))`
   - Bridge updates this store when reading or refreshing resources
7. Integration in tests / example script:
   - Show listing remote tools, calling one, reading a resource
8. Add edge-case handling (see below)
9. Documentation update in README.md (optional)
10. Write minimal unit tests:
    - Mock MCP server (or stub `McpClientManager`)
    - Test tool mapping
    - Test resource fetch
    - Test prompt injection

## Sample Skeletons

### `mcpClientManager.ts` (conceptual excerpt)
```ts
import {
  Client,
  StreamableHTTPClientTransport,
  SSEClientTransport,
  StdioClientTransport
} from '@modelcontextprotocol/sdk/client/index.js';
import { getDisplayName } from '@modelcontextprotocol/sdk/shared/metadataUtils.js';

type TransportConfig =
  | { type: 'http'; url: string }
  | { type: 'stdio'; command: string; args: string[] };

export class McpClientManager {
  private client: Client;
  private transportConfig: TransportConfig;
  private toolCache = new Map<string, any>();
  private resourceCache = new Map<string, any>();
  private promptCache = new Map<string, any>();
  private listeners: (() => Promise<void> | void)[] = [];

  constructor(opts: { transport: TransportConfig; clientInfo: { name: string; version: string } }) {
    this.transportConfig = opts.transport;
    this.client = new Client(opts.clientInfo);
  }

  async connect() {
    if (this.transportConfig.type === 'http') {
      try {
        const transport = new StreamableHTTPClientTransport(new URL(this.transportConfig.url));
        await this.client.connect(transport);
      } catch (err: any) {
        if (String(err?.status).startsWith('4')) {
          const fallback = new SSEClientTransport(new URL(this.transportConfig.url));
          await this.client.connect(fallback);
        } else throw err;
      }
    } else {
      const t = new StdioClientTransport({
        command: this.transportConfig.command,
        args: this.transportConfig.args
      });
      await this.client.connect(t);
    }
    await this.refreshAll();
  }

  async refreshAll() {
    const tools = await this.client.listTools().catch(() => ({ tools: [] }));
    const resources = await this.client.listResources().catch(() => ({ resources: [] }));
    const prompts = await this.client.listPrompts().catch(() => ({ prompts: [] }));

    this.toolCache.clear();
    tools.tools.forEach(t => this.toolCache.set(t.name, t));
    this.resourceCache.clear();
    resources.resources.forEach(r => this.resourceCache.set(r.uri, r));
    this.promptCache.clear();
    prompts.prompts.forEach(p => this.promptCache.set(p.name, p));

    await Promise.all(this.listeners.map(l => l()));
  }

  onListChanged(fn: () => Promise<void> | void) {
    this.listeners.push(fn);
  }

  listCachedTools() {
    return [...this.toolCache.values()];
  }

  async callTool(name: string, args: Record<string, any>) {
    return await this.client.callTool({ name, arguments: args });
  }

  async readResource(uri: string) {
    return await this.client.readResource({ uri });
  }

  async getPrompt(name: string, args: Record<string, any>) {
    return await this.client.getPrompt({ name, arguments: args });
  }
}
```

### `adapters.ts` excerpt
```ts
import z from 'zod';
import type { Tool } from '@src/fragola';
import type { McpClientManager } from './mcpClientManager';

export function jsonSchemaToZod(schema: any): z.ZodTypeAny {
  if (!schema || typeof schema !== 'object') return z.any();
  switch (schema.type) {
    case 'string':
      return schema.enum ? z.enum(schema.enum as [string, ...string[]]) : z.string();
    case 'number':
    case 'integer':
      return z.number();
    case 'boolean':
      return z.boolean();
    case 'array':
      return z.array(jsonSchemaToZod(schema.items));
    case 'object':
      const shape: Record<string, z.ZodTypeAny> = {};
      if (schema.properties) {
        for (const [k, v] of Object.entries(schema.properties)) {
          shape[k] = jsonSchemaToZod(v);
        }
      }
      let obj = z.object(shape);
      if (Array.isArray(schema.required)) {
        obj = obj.refine(val => schema.required.every(r => val[r] !== undefined), 'Missing required fields');
      }
      return obj;
    default:
      return z.any();
  }
}

export function mcpToolToFragolaTool(mcpTool: any, clientManager: McpClientManager): Tool {
  const schema = mcpTool.inputSchema ? jsonSchemaToZod(mcpTool.inputSchema) : undefined;
  return {
    name: mcpTool.name,
    description: mcpTool.description || 'Remote MCP tool',
    schema,
    handler: async (params) => {
      const res = await clientManager.callTool(mcpTool.name, params || {});
      // unify structuredContent or content textual forms
      if (res?.structuredContent) return res.structuredContent;
      const text = res?.content?.find((c: any) => c.type === 'text')?.text;
      return text || res;
    }
  };
}
```

### `mcpBridge.ts` fragment
```ts
import type { FragolaHook } from '@src/hook';
import { mcpToolToFragolaTool } from '../mcp/adapters';
import z from 'zod';

export const mcpBridge = (opts: {
  clientManager: any;
  autoResources?: boolean;
  promptAsTool?: boolean;
  syncIntervalMs?: number;
}): FragolaHook => (agent) => {
  const sync = async () => {
    const remoteTools = opts.clientManager.listCachedTools()
      .map((t: any) => mcpToolToFragolaTool(t, opts.clientManager));
    agent.context.updateTools(prev => {
      // naive merge: replace conflicts by remote version
      const filtered = prev.filter(p => !remoteTools.some(rt => rt.name === p.name));
      return [...filtered, ...remoteTools];
    });
  };

  opts.clientManager.onListChanged(sync);
  sync(); // initial

  if (opts.syncIntervalMs) {
    setInterval(sync, opts.syncIntervalMs).unref();
  }

  if (opts.autoResources) {
    agent.context.updateTools(prev => [...prev, {
      name: 'read_resource',
      description: 'Read a remote MCP resource by URI',
      schema: z.object({ uri: z.string() }),
      handler: async (params) => {
        const res = await opts.clientManager.readResource(params.uri);
        return res.contents?.map((c: any) => c.text).join('\n');
      }
    }]);
  }

  if (opts.promptAsTool) {
    agent.context.updateTools(prev => [...prev, {
      name: 'use_prompt',
      description: 'Inject a remote MCP prompt messages',
      schema: z.object({
        name: z.string(),
        args: z.record(z.any()).optional()
      }),
      handler: async (params, context) => {
        const prompt = await opts.clientManager.getPrompt(params.name, params.args || {});
        // Append messages from prompt directly
        const msgs = prompt.messages.map((m: any) => ({
          role: m.role,
          content: typeof m.content === 'object' && m.content?.text ? m.content.text : String(m.content)
        }));
        await context.raw.appendMessages(msgs, false, 'userMessage');
        return `Prompt '${params.name}' injected (${msgs.length} messages).`;
      }
    }]);
  }
};
```

## Event System Alignment

- No changes needed to core event types.
- Remote tool execution flows through existing `toolCall` events → enabling instrumentation (logging, metrics, guardrails) for remote calls.
- Consider adding a dedicated event type in future (`mcpListChanged`) if you want reactive adaptations (e.g. auto-adjust prompt instructions).

## Edge Cases & Mitigations

| Edge Case | Strategy |
|-----------|----------|
| Remote tool JSON schema complexity (recursive, `anyOf`, `oneOf`) | Fallback to `z.any()` + warn; store raw JSON schema for advanced validation later |
| Connection drop / transient HTTP errors | Reconnect loop with exponential backoff; keep last known cache; mark tools as temporarily unavailable |
| Tool removed server-side mid-session | On listChanged diff → remove mirrored tool from agent (context.updateTools) |
| Large resource content | Stream or truncate; optionally add `read_resource_summary` tool variant |
| Prompt arguments completion | Map MCP completion API later via a dedicated adapter; initially ignore |
| Auth (OAuth proxy) | Allow passing headers / tokens into transport; add `authProvider` config to `McpClientManager` |
| Rate limiting remote server | Queue tool calls; implement per-tool circuit breaker (optional future step) |
| SSE fallback stale | Periodic health check; if HTTP becomes available, attempt upgrade |
| Dynamic server changes (debounced notifications) | Since SDK already debounces, just refresh after each listChanged; optionally add manual refresh command |

## Security Notes

- Validate remote tool names (no collisions with sensitive internal tools).
- Sanitize any returned text before injecting into conversation if you later support user-facing UIs.
- If enabling `read_resource` on file URIs, consider whitelisting schemas (, `schema://` etc.).

## Incremental Implementation Order

1. Dependency & `McpClientManager`
2. Tool adapter & basic bridge hook
3. Resource reading tool
4. Prompt injection tool
5. JSON schema → Zod mapper (MVP)
6. Tests (unit for adapter, integration mock)
7. Reconnect & fallback logic
8. Documentation updates
9. Optional orchestration synergy (agents coordinate via remote MCP context)

## Minimal Test Suggestions

- `tests/mcp/adapter.test.ts`: JSON schema conversion (enum, object, array)
- `tests/mcp/bridgeToolRegistration.test.ts`: After bridge attach, remote tool appears in `agent.options.tools`
- `tests/mcp/remoteToolInvocation.test.ts`: Stub `client.callTool` returns object; handler transforms correctly
- `tests/mcp/promptInjection.test.ts`: Confirm conversation grows by injected messages

## Future Enhancements

- Add an MCP server mode to expose Fragola agent conversation or state as resources/tools.
- Caching layer for resources with ETag / version invalidation.
- Structured error mapping (wrap MCP errors → `FragolaError` subclasses).
- Metrics collector hook (time per remote tool call).
- Argument completion integration (`client.complete`) for tool arguments or prompt args (extend `mcpBridge`).
- Multi-server support: allow multiple `McpClientManager`s; unify remote tools under namespaced naming (`serverName.toolName`).

## Completion Summary

You now have:
- A mapping strategy from MCP constructs to Fragola’s tool & event system
- Concrete file/module plan
- Code skeletons for client manager, adapters, and bridge hook
- Edge case handling outline and improvement roadmap

Let me know if you’d like me to create the actual files in your workspace next, extend to server mode, or implement tests.