import { ProviderName, Provider } from "./types/providers";
import { FragolaHook } from "../../src/hook/index";
import { stripMessagesMeta } from "../../src/fragola";

import { RequestContext } from "./handlers/services/requestContext";
import { ProviderContext } from "./handlers/services/providerContext";
import { constructRequest } from "./handlers/handlerUtils";
import Providers from "./providers";
import type { ChatCompletion, ChatCompletionCreateParams } from "openai/resources/chat/completions";
import { ProviderEnv } from "./types/env";
import { AgentContext } from "../../src/agentContext";
import { endpointStrings } from "./providers/types";
import { createRouter } from "./router";
import { Options } from "./types/requestBody";

export function createLocalGatewayFetch(): typeof fetch {
  const router = createRouter();
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlString = input.toString();
    console.log("__DEBUG_BODY__ urlString:", urlString);
    console.log("__HEADERS__", JSON.stringify(init?.headers, null, 2));
    if (!init || init.headers == undefined)
      throw new Error("Expected headers to exist");

    // Convert to standard Headers object to access case-insensitively
    // const headers = new Headers(init.headers as HeadersInit);
    // const apiKey = headers.get("authorization"); // Safely gets "Bearer ..."
    // console.log("__apiKey__", apiKey);
    // process.exit(1);

    let endpoint: endpointStrings | undefined = (() => {
      const parsedUrl = input instanceof URL ? input : new URL(urlString, 'http://localhost'); // Provide a dummy base in case it's a relative path
      const path = parsedUrl.pathname; 
      const match = router.lookup(path);

      if (match) {
        const method = init?.method?.toUpperCase() || 'POST';
        // Explicitly assert the type to endpointStrings
        const matchedEndpoint = match[method as keyof typeof match] || match.endpoint;
        return matchedEndpoint as endpointStrings;
      }
      
      return undefined;
    })();
    console.log("__DEBUG_BODY__ endpoint:", endpoint);
    if (!endpoint) {
      throw new Error(`unhandled url: ${urlString}`)
    }

    let requestBody: any = {};
    if (init?.body) {
      if (typeof init.body === 'string') {
        try {
          requestBody = JSON.parse(init.body);
        } catch (e) {
          // not json
        }
      } else {
        // formData or other
        requestBody = init.body;
      }
    }

    const determineProvider = (modelStr?: string) => {
      if (typeof modelStr === 'string' && modelStr.startsWith('@')) {
        const parts = modelStr.substring(1).split('/');
        if (parts.length >= 2) {
          return { provider: parts[0], model: parts.slice(1).join('/') };
        }
      }
      return { provider: '', model: modelStr };
    };

    const { provider, model } = determineProvider(requestBody.model);
    if (!provider.length) {
      throw new Error("Could not determine provider from model string: " + requestBody.model);
    }

    requestBody.model = model;

    const requestHeaders: Record<string, string> = {};
    if (init?.headers) {
      const headersObj = new Headers(init.headers as HeadersInit);
      headersObj.forEach((value, key) => {
        requestHeaders[key.toLowerCase()] = value;
      });
    }
    if (!requestHeaders["content-type"]) {
      requestHeaders["content-type"] = "application/json";
    }

    const env: ProviderEnv = typeof process !== 'undefined' ? (process.env as ProviderEnv) : {};

    // In this generic fetcher without arguments, apiKey might need to be resolved from env directly or passed through headers
    // For now we'll rely on environment variables if no apiKey is explicitly provided
    let fullProviderOptions: Options = { provider };
    const headers = new Headers(init.headers as HeadersInit);
    let apiKey;

    apiKey = headers.get("authorization")?.trim().split("Bearer").join("").trim() || undefined;

    if (apiKey)
      fullProviderOptions["apiKey"] = apiKey;

    const requestContext = new RequestContext(
      env,
      fullProviderOptions,
      endpoint,
      requestHeaders,
      requestBody,
      init?.method || "POST"
    );

    requestContext.transformToProviderRequestAndSave();
    console.log("__DEBUG_BODY__ after transformToProviderRequestAndSave:", JSON.stringify(requestContext.transformedRequestBody, null, 2));

    const providerContext = new ProviderContext(provider);
    requestContext.requestURL = await providerContext.getFullURL(requestContext);
    console.log("__FULL_URL__", requestContext.requestURL);
    console.log("__BODY__", JSON.stringify(requestBody, null, 2))

    const fetchOptions = await constructRequest(providerContext, requestContext);

    const response = await fetch(requestContext.requestURL, fetchOptions);

    if (!response.ok) {
      // Just return the response, don't throw, let the SDK handle it
      return response;
    }

    // Determine if we need to transform the response
    const rawProviderText = await response.text();
    let rawProviderJson: any = null;
    try {
      rawProviderJson = JSON.parse(rawProviderText);
    } catch (e) {
      // If it's not JSON, return it as-is
      return new Response(rawProviderText, {
        status: response.status,
        headers: response.headers
      });
    }

    const providerConfig = Providers[provider];
    let providerTransformers = providerConfig?.responseTransforms;
    if (providerConfig?.getConfig) {
      providerTransformers = providerConfig.getConfig({
        params: requestBody,
        providerOptions: fullProviderOptions,
      }).responseTransforms;
    }

    const responseTransformerFunction = providerTransformers?.[endpoint];
    if (!responseTransformerFunction) {
      return new Response(JSON.stringify(rawProviderJson), {
        status: response.status,
        headers: response.headers
      });
    }

    const mappedResponse = responseTransformerFunction(
      rawProviderJson,
      response.status,
      response.headers,
      false,
      urlString,
      requestBody
    );

    return new Response(JSON.stringify(mappedResponse), {
      status: response.status,
      headers: response.headers
    });
  };
}

export const provider = <K extends ProviderName>(name: K, config: Provider<K>): FragolaHook => (agent) => {
  let events: (() => void)[] = [];
  const { context } = agent;
  const localFetch = createLocalGatewayFetch();
  console.log("#here1");
  context.instance.setSdkOpts({ ...context.instance.options, fetch: localFetch });
  // events = [...events, agent.onBeforeModelInvocation(({ context, config }) => {
  //   const ctx = context as AgentContext;
  //   if (!("modelSettings" in config)) {
  //     return config;
  //   }

  //   return config;
  // })]
  return () => {
  }
}
