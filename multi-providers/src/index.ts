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

export async function executeIsolatedProviderRequest(
  provider: string,
  providerOptions: any,
  openaiRequest: ChatCompletionCreateParams
): Promise<ChatCompletion> {
  const env: ProviderEnv = typeof process !== 'undefined' ? (process.env as ProviderEnv) : {};
  const fullProviderOptions = { ...providerOptions, provider };

  const requestContext = new RequestContext(
    env,
    fullProviderOptions,
    "chatComplete",
    { "content-type": "application/json" },
    //@ts-expect-error
    openaiRequest,
    "POST"
  );

  requestContext.transformToProviderRequestAndSave();

  const providerContext = new ProviderContext(provider);
  requestContext.requestURL = await providerContext.getFullURL(requestContext);

  const fetchOptions = await constructRequest(providerContext, requestContext);

  const response = await fetch(requestContext.requestURL, fetchOptions);

  if (!response.ok) {
    throw new Error(`Provider API Error [${response.status}]: ${await response.text()}`);
  }

  const rawProviderJson = await response.json();

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
    return rawProviderJson as ChatCompletion;
  }

  const mappedResponse = responseTransformerFunction(
    rawProviderJson,
    response.status,
    response.headers,
    false, 
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
        const ctx = context as AgentContext;
        ctx.instance.setSdkOpts({...ctx.instance.options, fetch: ()})

        // const instructionsRole = context.options.useDeveloperRole ? "developer" : "system";
        // const tools = context.state.tools?.length ? context.state.tools.map(t => ({
        //     type: "function" as const,
        //     function: {
        //         name: t.name,
        //         description: t.description,
        //         parameters: t.parameters
        //     }
        // })) : undefined;

        // const requestBody = {
        //     ...config.modelSettings,
        //     messages: [
        //         { role: instructionsRole, content: context.systemPrompt },
        //         ...stripMessagesMeta(context.state.messages)
        //     ],
        //     ...(tools ? { tools } : {})
        // } as ChatCompletionCreateParams;

        //  return {
        //   ...config,
        //   injectResponse: async () => {
        //     return await executeIsolatedProviderRequest(
        //       name,
        //       {
        //         apiKey: context.instance.options["apiKey"]
        //       },
        //       requestBody
        //     );
        //   }
        // };
        return config;
    })]
    return () => {
    }
}
