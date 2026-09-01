// requestContext.ts

import { ProviderEnv } from '../../types/env';
import { Options, Params } from '../../types/requestBody';
import { endpointStrings } from '../../providers/types';
import { HEADER_KEYS } from '../../globals';
import { transformToProviderRequest } from '../../services/transformToProviderRequest';

export class RequestContext {
  private _params: Params | null = null;
  private _transformedRequestBody: any;
  public readonly providerOption: Options;
  private _requestURL: string = '';

  constructor(
    public readonly env: ProviderEnv,
    providerOption: Options,
    public readonly endpoint: endpointStrings,
    public readonly requestHeaders: Record<string, string>,
    public readonly requestBody:
      | Params
      | FormData
      | ReadableStream
      | ArrayBuffer,
    public readonly method: string = 'POST'
  ) {
    this.providerOption = providerOption;
  }

  get requestURL(): string {
    return this._requestURL;
  }

  set requestURL(requestURL: string) {
    this._requestURL = requestURL;
  }

  get overrideParams(): Params {
    return this.providerOption?.overrideParams ?? {};
  }

  get params(): Params {
    if (this._params !== null) {
      return this._params;
    }
    return this.requestBody instanceof ReadableStream ||
      this.requestBody instanceof FormData ||
      !this.requestBody
      ? {}
      : { ...this.requestBody, ...this.overrideParams };
  }

  set params(params: Params) {
    this._params = params;
  }

  set transformedRequestBody(transformedRequestBody: any) {
    this._transformedRequestBody = transformedRequestBody;
  }

  get transformedRequestBody(): any {
    return this._transformedRequestBody;
  }

  getHeader(key: string): string {
    if (key == HEADER_KEYS.CONTENT_TYPE) {
      return (
        this.requestHeaders[HEADER_KEYS.CONTENT_TYPE.toLowerCase()]?.split(
          ';'
        )[0] ?? ''
      );
    }
    return this.requestHeaders[key] ?? '';
  }

  get isStreaming(): boolean {
    if (
      (this.endpoint === 'imageEdit' ||
        this.endpoint === 'createTranscription') &&
      this.requestBody instanceof FormData
    )
      return this.requestBody.get('stream') === 'true';
    return this.params.stream === true;
  }

  get strictOpenAiCompliance(): boolean {
    return true; // Simplify
  }

  get forwardHeaders(): string[] {
    const headerKey = HEADER_KEYS.FORWARD_HEADERS;
    return (
      this.requestHeaders[headerKey]?.split(',').map((h) => h.trim()) ||
      this.providerOption.forwardHeaders ||
      []
    );
  }

  get customHost(): string {
    return (
      this.requestHeaders[HEADER_KEYS.CUSTOM_HOST] ||
      this.providerOption.customHost ||
      ''
    );
  }

  get requestTimeout(): number | null {
    const headerKey = HEADER_KEYS.REQUEST_TIMEOUT;
    return (
      Number(this.requestHeaders[headerKey]) ||
      this.providerOption.requestTimeout ||
      null
    );
  }

  get provider(): string {
    return this.providerOption?.provider ?? '';
  }

  transformToProviderRequestAndSave() {
    if (this.method !== 'POST') {
      this.transformedRequestBody = this.requestBody;
      return;
    }
    this.transformedRequestBody = transformToProviderRequest(
      this.provider,
      this.params,
      this.requestBody,
      this.endpoint,
      this.requestHeaders,
      this.providerOption
    );
  }
}
