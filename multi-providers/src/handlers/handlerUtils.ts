import { HEADER_KEYS, CONTENT_TYPES, POWERED_BY } from '../globals';
import { RequestContext } from './services/requestContext';
import { ProviderContext } from './services/providerContext';
import { ProviderEnv } from '../types/env';

function constructRequestBody(
  requestContext: RequestContext,
  providerHeaders: Record<string, string>
): BodyInit | null {
  const headerContentType = providerHeaders[HEADER_KEYS.CONTENT_TYPE];
  const requestContentType = requestContext.getHeader(HEADER_KEYS.CONTENT_TYPE);

  let body: BodyInit | null = null;

  const isMultiPartRequest =
    headerContentType === CONTENT_TYPES.MULTIPART_FORM_DATA ||
    (requestContext.endpoint == 'proxy' &&
      requestContentType === CONTENT_TYPES.MULTIPART_FORM_DATA);

  const isProxyAudio =
    requestContext.endpoint == 'proxy' &&
    requestContentType?.startsWith(CONTENT_TYPES.GENERIC_AUDIO_PATTERN);

  const reqBody = requestContext.transformedRequestBody;

  if (isMultiPartRequest) {
    body = reqBody as FormData;
  } else if (requestContext.requestBody instanceof ReadableStream) {
    body = requestContext.requestBody;
  } else if (isProxyAudio) {
    body = reqBody as ArrayBuffer;
  } else if (requestContentType) {
    body = JSON.stringify(reqBody);
  }

  if (['GET', 'DELETE'].includes(requestContext.method)) {
    body = null;
  }

  console.log("__DEBUG_BODY__ fetchOptions body in constructRequestBody:", body);

  return body;
}

function constructRequestHeaders(
  requestContext: RequestContext,
  providerConfigMappedHeaders: any
): Record<string, string> {
  const {
    method,
    forwardHeaders,
    requestHeaders,
    endpoint: fn,
    env,
  } = requestContext;

  const proxyHeaders: Record<string, string> = {};
  if (fn === 'proxy') {
    const poweredByHeadersPattern = `x-${POWERED_BY}-`;
    const headersToAvoidForCloudflare = ['expect'];
    const headersToIgnore = [
      ...(env?.CUSTOM_HEADERS_TO_IGNORE ? [env.CUSTOM_HEADERS_TO_IGNORE] : []),
      ...headersToAvoidForCloudflare,
    ];
    headersToIgnore.push('content-length');
    Object.keys(requestHeaders).forEach((key: string) => {
      if (
        !headersToIgnore.includes(key) &&
        !key.startsWith(poweredByHeadersPattern)
      ) {
        proxyHeaders[key] = requestHeaders[key];
      }
    });
  }
  const baseHeaders: any = {
    'content-type': 'application/json',
  };

  let headers: Record<string, string> = {};

  Object.keys(providerConfigMappedHeaders).forEach((h: string) => {
    headers[h.toLowerCase()] = providerConfigMappedHeaders[h];
  });

  const forwardHeadersMap: Record<string, string> = {};

  forwardHeaders.forEach((h: string) => {
    const lowerCaseHeaderKey = h.toLowerCase();
    if (requestHeaders[lowerCaseHeaderKey])
      forwardHeadersMap[lowerCaseHeaderKey] =
        requestHeaders[lowerCaseHeaderKey];
  });

  headers = {
    ...baseHeaders,
    ...headers,
    ...forwardHeadersMap,
    ...(fn === 'proxy' && proxyHeaders),
  };

  const contentType = headers['content-type']?.split(';')[0];
  const isGetMethod = method === 'GET';
  const isMultipartFormData = contentType === CONTENT_TYPES.MULTIPART_FORM_DATA;
  const shouldDeleteContentTypeHeader =
    (isGetMethod || isMultipartFormData) && headers;

  if (shouldDeleteContentTypeHeader) {
    delete headers['content-type'];
    if (fn === 'uploadFile') {
      headers['Content-Type'] = requestHeaders['content-type'];
      if (requestHeaders[`x-${POWERED_BY}-file-purpose`]) {
        headers[`x-${POWERED_BY}-file-purpose`] =
          requestHeaders[`x-${POWERED_BY}-file-purpose`];
      }
    }
  }

  return headers;
}

export async function constructRequest(
  providerContext: ProviderContext,
  requestContext: RequestContext
): Promise<RequestInit> {
  const providerMappedHeaders =
    await providerContext.getHeaders(requestContext);

  const headers = constructRequestHeaders(
    requestContext,
    providerMappedHeaders
  );

  const fetchOptions: RequestInit = {
    method: requestContext.method,
    headers,
    ...(requestContext.endpoint === 'uploadFile' && { duplex: 'half' }),
  };

  const body = constructRequestBody(requestContext, providerMappedHeaders);
  if (body) {
    fetchOptions.body = body;
  }
  return fetchOptions;
}
