# Client-Side Multi-Provider Hook Solution for Fragola (Isolated Translation & Fetch)

Following a deep trace of how the Portkey AI Gateway operates, this document outlines an updated strategy for reusing the gateway's logic within Fragola to support multiple LLM providers directly from the client side, **without using Hono, routing handlers, retry logic, or guardrails**.

## Key Finding: How Portkey's Translation Engine Really Works

While Portkey Gateway relies on Hono as a web server framework, its underlying **request and response translation modules are pure and stateless**. They do not require a running server or router. We can invoke these modules in complete isolation by constructing a lightweight, stubbed `honoContext` and leveraging Portkey's core structures:

1. **`transformToProviderRequest`**: Reuses the provider schema mappings to map standard OpenAI parameters to any provider-specific parameters.
2. **`ProviderContext` & `RequestContext`**: Resolves the provider's API base URL, endpoints, and formats the specific request headers (such as `x-api-key`, API version headers, etc.).
3. **`constructRequest`**: Compiles everything into standard `RequestInit` fetch options containing the mapped body and headers.
4. **`responseTransforms`**: Lookups the registered response transformation module for the target provider and parses the response JSON back into the standard OpenAI `ChatCompletion` schema.

---

## The Isolated Strategy for Fragola

We can bundle the ported provider configs from `multi-providers/src/providers/` and call the translation layers directly in our Fragola Hook via the `before:modelInvocation` event. 

By utilizing Fragola's `injectResponse` callback, we bypass Fragola's default client entirely and execute the translated request directly.

### 1. The Lightweight Context Stub

To satisfy references inside Portkey's classes (e.g., getting the runtime key or request URL), we use a minimal mock context object:

```typescript
const mockHonoContext = {
  req: {
    url: "https://api.openai.com/v1/chat/completions",
    raw: {
      headers: new Headers()
    }
  },
  env: process.env,
  get: (key: string) => {
    if (key === 'hooksManager') {
      return {
        getSpan: () => ({
          getHooksResult: () => null
        })
      };
    }
    return null;
  },
  set: () => {}
} as any;
```

---

### 2. Isolated Provider Request & Mapping Code

Below is the complete, isolated implementation showing how to execute the API request and apply both request/response translation without any Hono middlewares or routing logic:

```typescript
import { RequestContext } from "./handlers/services/requestContext";
import { ProviderContext } from "./handlers/services/providerContext";
import { constructRequest } from "./handlers/handlerUtils";
import Providers from "./providers";
import type { ChatCompletion, ChatCompletionCreateParams } from "openai/resources/chat/completions";

/**
 * Executes an isolated provider request using ported Portkey translation modules.
 * This function bypasses all Hono, routing, and retry logic.
 */
export async function executeIsolatedProviderRequest(
  provider: string,
  providerOptions: any,
  openaiRequest: ChatCompletionCreateParams
): Promise<ChatCompletion> {
  // 1. Stub the Hono Context needed by request constructors
  const mockHonoContext = {
    req: {
      url: "https://api.openai.com/v1/chat/completions",
      raw: { headers: new Headers() }
    },
    env: process.env,
    get: (key: string) => {
      if (key === 'hooksManager') {
        return {
          getSpan: () => ({ getHooksResult: () => null })
        };
      }
      return null;
    },
    set: () => {}
  } as any;

  // 2. Initialize the RequestContext
  const requestContext = new RequestContext(
    mockHonoContext,
    providerOptions,
    "chatComplete",
    {}, // request headers
    openaiRequest,
    "POST",
    0 // index
  );

  // 3. Map OpenAI request body parameters to the target provider schema and save it
  requestContext.transformToProviderRequestAndSave();

  // 4. Initialize ProviderContext and resolve full target endpoint URL
  const providerContext = new ProviderContext(provider);
  requestContext.requestURL = await providerContext.getFullURL(requestContext);

  // 5. Construct final fetch options (maps request body, api-keys, and provider custom headers)
  const fetchOptions = await constructRequest(providerContext, requestContext);

  // 6. Make the native fetch call
  const response = await fetch(requestContext.requestURL, fetchOptions);

  if (!response.ok) {
    throw new Error(`Provider API Error [${response.status}]: ${await response.text()}`);
  }

  // 7. Parse the raw provider response JSON
  const rawProviderJson = await response.json();

  // 8. Resolve the provider response transformer
  const providerConfig = Providers[provider];
  let providerTransformers = providerConfig?.responseTransforms;
  if (providerConfig?.getConfig) {
    providerTransformers = providerConfig.getConfig({
      params: openaiRequest,
      providerOptions,
    }).responseTransforms;
  }

  const responseTransformerFunction = providerTransformers?.["chatComplete"];
  if (!responseTransformerFunction) {
    // If no custom response mapping is defined, return raw json directly
    return rawProviderJson as ChatCompletion;
  }

  // 9. Map the native provider JSON back to standard OpenAI ChatCompletion schema
  const mappedResponse = responseTransformerFunction(
    rawProviderJson,
    response.status,
    response.headers,
    false, // strictOpenAiCompliance
    "https://api.openai.com/v1/chat/completions",
    openaiRequest
  );

  return mappedResponse as ChatCompletion;
}
```

---

### 3. Example Fragola Hook Integration

By embedding `executeIsolatedProviderRequest` inside Fragola's `before:modelInvocation` hook, we achieve seamless integration:

```typescript
import { executeIsolatedProviderRequest } from "./index";
import type { ChatCompletionCreateParams } from "openai/resources/chat/completions";

export const providerHook = (provider: string, providerOptions: any) => ({
  name: "isolated-multi-provider-hook",
  events: [
    {
      name: "before:modelInvocation",
      callback: async ({ config, context }) => {
        // Construct the expected standard OpenAI request payload
        const openaiRequest: ChatCompletionCreateParams = {
          ...config.modelSettings,
          messages: [
            { role: "system", content: context.systemPrompt },
            ...context.state.messages
          ]
        };

        return {
          ...config,
          injectResponse: async () => {
            // Execute the isolated request using ported gateway files
            return await executeIsolatedProviderRequest(
              provider,
              providerOptions,
              openaiRequest
            );
          }
        };
      }
    }
  ]
});
```

---

## Benefits of the Isolated Port Strategy
1. **No Manual Schema Mapping**: We rely entirely on the rich, tested schema-to-schema translation maps of the Portkey Gateway (under `/src/providers/*`), supporting dozens of models without any manual mapper development.
2. **Zero Framework Overhead**: Removing Hono and the recursive router keeps the runtime lightweight, fast, and entirely free from web server abstractions.
3. **Pure Native Fetch**: We run cleanly on native browser or runtime `fetch`, avoiding massive external SDK wrappers and keeping bundle size to a minimum.
