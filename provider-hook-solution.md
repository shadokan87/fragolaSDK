# Client-Side Multi-Provider Hook Solution for Fragola

Following a deep trace of how the Portkey AI Gateway operates, this document outlines an updated strategy for reusing the gateway's logic within Fragola to support multiple LLM providers directly from the client side.

## Key Finding: How Portkey Gateway Really Works

A trace of Portkey Gateway reveals that it **does not use the provider-specific SDKs** (such as `@anthropic-ai/sdk` or `@google/generative-ai`). Instead, it handles multi-provider routing entirely at the HTTP and JSON levels. 

Here is exactly how Portkey Gateway processes an API request to a provider:

1. **Routing and Strategies (`gateway/src/handlers/handlerUtils.ts`)**:
   - The entry point for provider selection is `tryTargetsRecursively`.
   - This function implements a `switch (strategyMode)` statement that dictates how to handle targets. The strategies include `FALLBACK` (iterating through an array of targets and stopping when one succeeds), `LOADBALANCE` (randomly selecting a target based on weighted probabilities), `CONDITIONAL` (using a `ConditionalRouter` to parse headers and metadata to pick a target), and `SINGLE`.
   - Once a target is selected, `tryTargetsRecursively` calls `tryPost` to execute the request.

2. **Provider Resolution (`gateway/src/handlers/services/providerContext.ts`)**:
   - Inside `tryPost`, a `ProviderContext` is initialized with the name of the target provider (e.g., `'anthropic'`).
   - Rather than a hardcoded `switch` statement for every provider, Portkey maintains a registry pattern in `gateway/src/providers/index.ts`. It exports a massive `Providers` object mapping provider names (`'anthropic'`, `'openai'`, `'google'`, etc.) to their respective configuration and translation modules (e.g., `AnthropicConfig`).
   - The `ProviderContext` simply looks up `Providers[this.provider]` to retrieve the correct API URLs, header functions, and schema mappers.

3. **Schema Translation (`gateway/src/providers/*`)**: 
   - It maps the inbound OpenAI-formatted request body into the target provider's native REST API schema by calling the transformation functions registered in the provider's config module.

4. **Raw Fetch (`gateway/src/handlers/retryHandler.ts`)**: 
   - It executes a raw `fetch` call to the target endpoint, wrapping it in custom retry and timeout logic via the `retryRequest` function.

5. **Response Translation**: 
   - It translates the provider's JSON response back into the standard OpenAI `ChatCompletion` schema using the `responseTransform` functions defined in the provider's module.

## The Strategy for Fragola

Since Portkey relies on pure JSON-to-JSON transformations, raw HTTP `fetch` calls, and a modular registry for its providers, we can lift this logic directly into a Fragola Hook. 

Crucially, **we do not need to hack the internal OpenAI SDK via a custom fetcher**. Fragola's `before:modelInvocation` event supports an `injectResponse` capability, which allows the hook to completely bypass the underlying OpenAI SDK and provide the response itself.

### The Architecture

1. **The Hook Engine (`before:modelInvocation`)**
   We will create a hook that intercepts the agent just before it calls the model. Instead of returning the default configuration, the hook will return `injectResponse: () => Promise<ChatCompletion>`. This tells Fragola, "Do not use your internal OpenAI client; use this response instead."

2. **The Portkey Translation Layer**
   We port the provider mappers (the `gateway/src/providers` registry) and the `tryTargetsRecursively` routing logic directly into the hook package. This logic takes the `modelSettings` and `messages` from the Fragola agent, picks the provider based on the `strategyMode`, converts the request, executes the native `fetch`, and maps the result back to an OpenAI response.

3. **Routing Configuration**
   The hook accepts a configuration object matching Portkey's `Targets` structure, dictating the fallback, load balancing, or single provider logic.

### Example Implementation

```typescript
import type { ChatCompletion, ChatCompletionCreateParams } from "openai/resources/chat/completions";
// Import ported logic from Portkey Gateway
import { tryTargetsRecursively } from "./gateway-ports/handlerUtils"; 

export const multiProviderHook = (routingConfig: any) => ({
  name: "multi-provider-hook",
  events: [
    {
      name: "before:modelInvocation",
      callback: async ({ config, context }) => {
        // Construct the OpenAI-formatted request that Fragola would normally send
        const requestBody: ChatCompletionCreateParams = {
            ...config.modelSettings,
            messages: [
                { role: "system", content: context.systemPrompt },
                ...context.state.messages
            ]
        };

        // Inject our custom execution logic, bypassing Fragola's OpenAI SDK
        return {
            ...config,
            injectResponse: async (): Promise<ChatCompletion> => {
                
                // Execute the request using Portkey's recursive routing and translation logic.
                // This handles fallback loops, load balancing, translation, and raw fetch.
                const response = await tryTargetsRecursively(
                    // Pass a minimal context object if needed by the ported logic
                    {}, 
                    routingConfig, 
                    requestBody, 
                    {}, 
                    "chatComplete", 
                    "POST", 
                    "config"
                );

                if (!response.ok) {
                    throw new Error(`Provider API Error: ${await response.text()}`);
                }

                // The ported tryTargetsRecursively already translates the response back to OpenAI format
                return await response.json() as ChatCompletion;
            }
        };
      }
    }
  ]
});
```

## Benefits of the `injectResponse` Strategy
1. **No External SDK Dependencies**: Since we reuse Portkey's schema mapping, we avoid bundling massive provider SDKs. We only need native `fetch`.
2. **Total Control**: The `injectResponse` callback cleanly circumvents the OpenAI SDK, avoiding the complexity of modifying `fetch` interceptors deep inside the OpenAI client instance.
3. **Advanced Orchestration**: Because the fetch execution is fully in our hands inside `injectResponse`, we can easily implement Portkey's Fallback, Retry, and Load Balancing logic directly within the hook by porting `tryTargetsRecursively`.
4. **Seamless Integration**: To the Fragola agent, the hook behaves completely transparently. The agent still receives a perfect OpenAI schema response, ensuring downstream events (`after:modelInvocation`, tool parsing) work flawlessly.
