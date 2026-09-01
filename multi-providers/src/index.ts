import { ProviderName, Provider } from "./types/providers";
import { FragolaHook } from "../../src/hook/index";

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

  const fullProviderOptions = { ...providerOptions, provider };

  // 2. Initialize the RequestContext
  const requestContext = new RequestContext(
    mockHonoContext,
    fullProviderOptions,
    "chatComplete",
    { "content-type": "application/json" }, // request headers
    //@ts-expect-error
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
        //@ts-expect-error
      params: openaiRequest,
      providerOptions: fullProviderOptions,
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

export const provider = <K extends ProviderName>(name: K, config: Provider<K>): FragolaHook => (agent) => {
    let events: (() => void)[] = [];

    events = [...events, agent.onBeforeModelInvocation(({ context, config }) => {
        if (!("modelSettings" in config)) {
            return config;
        }

        const requestBody = {...context.instance.options, ...context.buildRequestBody()}
        console.log("!body", JSON.stringify(requestBody, null, 2));
         return {
          ...config,
          injectResponse: async () => {
            // Execute the isolated request using ported gateway files
            return await executeIsolatedProviderRequest(
              name,
              {
                apiKey: context.instance.options["apiKey"]
              },
              requestBody
            );
          }
        };
        return config;
    })]
    return () => {

    }
}

provider("google", {});