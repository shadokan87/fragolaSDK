// providerContext.ts

import {
  ProviderAPIConfig,
  ProviderConfigs,
  RequestHandlers,
} from '../../providers/types';
import Providers from '../../providers';
import { RequestContext } from './requestContext';
import { ANTHROPIC, AZURE_OPEN_AI } from '../../globals';
import { GatewayError } from '../../errors/GatewayError';

export class ProviderContext {
  constructor(private provider: string) {
    if (!Providers[provider]) {
      throw new GatewayError(`Provider ${provider} not found`);
    }
  }

  get providerConfig(): ProviderConfigs {
    return Providers[this.provider];
  }

  get apiConfig(): ProviderAPIConfig {
    return this.providerConfig.api;
  }

  async getHeaders(context: RequestContext): Promise<Record<string, any>> {
    return await this.apiConfig?.headers({
      env: context.env,
      providerOptions: context.providerOption,
      fn: context.endpoint,
      transformedRequestBody: context.transformedRequestBody,
      transformedRequestUrl: context.requestURL,
      gatewayRequestBody: context.params,
      headers: context.requestHeaders,
    });
  }

  /**
   * Get the base URL for the provider. Be careful, this returns a promise.
   * @returns The base URL for the provider.
   */
  async getBaseURL(context: RequestContext): Promise<string> {
    return await this.apiConfig.getBaseURL({
      providerOptions: context.providerOption,
      fn: context.endpoint,
      env: context.env,
      gatewayRequestURL: '',
      params: context.params,
    });
  }

  getEndpointPath(context: RequestContext): string {
    return this.apiConfig.getEndpoint({
      env: context.env,
      providerOptions: context.providerOption,
      fn: context.endpoint,
      gatewayRequestBodyJSON: context.params,
      gatewayRequestBody: {}, // not using anywhere.
      gatewayRequestURL: '',
    });
  }

  getProxyPath(context: RequestContext, baseURL: string): string {
    let reqPath = '/v1';
    const reqQuery = '';

    if (this.apiConfig?.getProxyEndpoint) {
      return `${baseURL}${this.apiConfig.getProxyEndpoint({
        reqPath,
        reqQuery,
        providerOptions: context.providerOption,
      })}`;
    }

    let proxyPath = `${baseURL}${reqPath}${reqQuery}`;

    if (this.provider === ANTHROPIC) {
      proxyPath = proxyPath.replace('/v1/v1/', '/v1/');
    }

    return proxyPath;
  }

  async getFullURL(context: RequestContext): Promise<string> {
    const baseURL = context.customHost || (await this.getBaseURL(context));
    let url: string;
    if (context.endpoint === 'proxy') {
      url = this.getProxyPath(context, baseURL);
    } else {
      const endpointPath = this.getEndpointPath(context);
      url = `${baseURL}${endpointPath}`;
    }

    return url;
  }

  get requestHandlers(): RequestHandlers {
    return this.providerConfig?.requestHandlers ?? {};
  }

  hasRequestHandler(context: RequestContext): boolean {
    return Boolean(this.requestHandlers?.[context.endpoint]);
  }

  getRequestHandler(
    context: RequestContext
  ): (() => Promise<Response>) | undefined {
    const requestHandler = this.requestHandlers?.[context.endpoint];
    if (!requestHandler) {
      return undefined;
    }

    return () =>
      requestHandler({
        env: context.env,
        providerOptions: context.providerOption,
        requestURL: '',
        requestHeaders: context.requestHeaders,
        requestBody: context.requestBody,
      });
  }
}
