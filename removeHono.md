# Plan: Remove Hono Dependency from `multi-providers`

The `multi-providers` module is a client-side port of the Portkey Gateway. Currently, it relies heavily on the `hono` package's `Context` object, creating a need for mocked contexts (e.g., `mockHonoContext`) and awkward bridging logic. 

To make the port fully independent of `hono` (without installing it or mocking it), follow this structured plan:

## 1. Delete Unused Server and Middleware Files
The Portkey Gateway source code includes a massive routing and middleware layer meant for running a web server. Since Fragola only needs the translation engine, we can safely delete:
- `src/middlewares/` (entire folder including cache, hooks, requestValidator, log)
- `src/handlers/` (delete files like `completionsHandler.ts`, `realtimeHandler.ts`, `modelsHandler.ts`, etc. Only keep utilities strictly required for building the request, like `handlerUtils.ts` or `services/` if you still use them)
- `src/utils/mockHono.ts`

## 2. Define a Native Environment Interface
Create a lightweight, framework-agnostic interface (e.g., `ProviderEnv`) in `src/types/env.ts` to manage environment variables (used by providers like AWS or Azure).
```typescript
export type ProviderEnv = Record<string, string | undefined>;
```

## 3. Update Core Interfaces in `src/providers/types.ts`
Remove all `import { Context } from 'hono'` references. Replace the `c: Context` parameter with `env: ProviderEnv` inside `ProviderAPIConfig`.
```typescript
export interface ProviderAPIConfig {
  headers: (args: {
    env: ProviderEnv; // replaced 'c: Context'
    providerOptions: Options;
    fn: string;
    transformedRequestBody: Record<string, any>;
    transformedRequestUrl: string;
    gatewayRequestBody?: Params;
    headers?: Record<string, string>;
  }) => Promise<Record<string, any>> | Record<string, any>;

  getBaseURL: (args: {
    env: ProviderEnv; // replaced 'c: Context'
    providerOptions: Options;
    fn?: endpointStrings;
    // ...
  }) => Promise<string> | string;
  
  getEndpoint: (args: {
    env: ProviderEnv; // replaced 'c: Context'
    providerOptions: Options;
    // ...
  }) => string;
  // ...
}
```

## 4. Refactor `src/utils/env.ts`
Remove `hono/adapter` completely.
Replace the `getRuntimeKey()` check with standard JavaScript/Node checks:
```typescript
const isNodeInstance = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;
```
Update the `Environment` function to accept our native `ProviderEnv`:
```typescript
export const Environment = (envObj?: ProviderEnv) => {
  if (isNodeInstance) return nodeEnv;
  return envObj || {};
};
```

## 5. Refactor `RequestContext` and `ProviderContext`
In `src/handlers/services/requestContext.ts`:
- Remove `public readonly honoContext: Context` from the constructor.
- Replace it with `public readonly env: ProviderEnv`.
- Remove any methods that interacted with Hono state (e.g., `get hooksManager()`, `get requestOptions()`, `appendRequestOptions()`).

In `src/handlers/services/providerContext.ts`:
- Change calls from `this.apiConfig.headers({ c: context.honoContext, ... })` to `this.apiConfig.headers({ env: context.env, ... })`.
- Remove references to `context.honoContext.req.url` (e.g., in `getProxyPath`). Providers only need to know the base URL and endpoint type.

## 6. Update All Provider Implementations
Perform a codebase-wide find-and-replace in the `src/providers/` directory to update the `ProviderAPIConfig` implementations:
- Change the destructured parameter `c` to `env` in `headers`, `getBaseURL`, and `getEndpoint`.
- Pass `env` into `Environment(env)` instead of `Environment(c)`.
- **Note**: Since there are many providers, you can use regex replacements across `src/providers/**/*.ts`:
  - Regex find: `c(\s*[:,]?\s*Context)?` or just replacing destructuring `({ providerOptions, fn, c })` -> `({ providerOptions, fn, env })`
  - Find: `Environment(c)` -> Replace: `Environment(env)`

## 7. Refactor the Isolated Execution Hook (`src/index.ts`)
Update `executeIsolatedProviderRequest` to initialize `RequestContext` natively without a mock context.

```typescript
export async function executeIsolatedProviderRequest(
  provider: string,
  providerOptions: any,
  openaiRequest: ChatCompletionCreateParams
): Promise<ChatCompletion> {
  const fullProviderOptions = { ...providerOptions, provider };
  
  // Use a simple object or process.env for the environment
  const env: ProviderEnv = typeof process !== 'undefined' ? (process.env as ProviderEnv) : {};

  const requestContext = new RequestContext(
    env,
    fullProviderOptions,
    "chatComplete",
    { "content-type": "application/json" },
    openaiRequest,
    "POST",
    0
  );

  // ... proceed with translation and fetch ...
}
```

## 8. Uninstall the Hono Package
Once all imports and type definitions are removed, you can safely drop `hono` from your dependencies.
```bash
npm uninstall hono
```