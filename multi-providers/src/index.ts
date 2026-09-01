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

export function createLocalGatewayFetch(): typeof fetch {
  const router = createRouter();
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlString = input.toString();

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
    if (!provider) {
      throw new Error("Could not determine provider from model string: " + requestBody.model);
    }

    requestBody.model = model;

    const requestHeaders = (init?.headers as Record<string, string>) || { "content-type": "application/json" };

    const env: ProviderEnv = typeof process !== 'undefined' ? (process.env as ProviderEnv) : {};

    // Extract API key from headers if present (OpenAI SDK uses Authorization: Bearer <key>)
    const authHeader = requestHeaders['Authorization'] || requestHeaders['authorization'];
    authHeader.replace('Bearer ', process.env["GOOGLE_API_KEY"]);
    console.log("__HEADER__", JSON.stringify(authHeader, null, 2));
    process.exit(1);
    // let apiKey = authHeader ? authHeader.replace('Bearer ', '').trim() : undefined;
    // if (!apiKey) {
    //   apiKey = requestHeaders['api-key'];
    // }

    // // Assign the API key to the appropriate environment variable based on the provider
    // if (apiKey) {
    //   if (provider === 'google') env.GOOGLE_API_KEY = apiKey;
    //   else if (provider === 'openai') env.OPENAI_API_KEY = apiKey;
    //   else if (provider === 'anthropic') env.ANTHROPIC_API_KEY = apiKey;
    //   // Add other providers as needed, or set a generic one
    // }

    // In this generic fetcher without arguments, apiKey might need to be resolved from env directly or passed through headers
    // For now we'll rely on environment variables if no apiKey is explicitly provided
    const fullProviderOptions = { provider };

    const requestContext = new RequestContext(
      env,
      fullProviderOptions,
      endpoint,
      requestHeaders,
      requestBody,
      init?.method || "POST"
    );

    requestContext.transformToProviderRequestAndSave();

    const providerContext = new ProviderContext(provider);
    requestContext.requestURL = await providerContext.getFullURL(requestContext);
    console.log("__FULL_URL__", requestContext.requestURL);

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
