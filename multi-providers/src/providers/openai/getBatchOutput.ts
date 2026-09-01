import OpenAIAPIConfig from './api';
import { Options } from '../../types/requestBody';
import { RetrieveBatchResponse } from '../types';

// Return a ReadableStream containing batches output data
export const OpenAIGetBatchOutputRequestHandler = async ({
  env,
  providerOptions,
  requestURL,
}: {
  env: ProviderEnv;
  providerOptions: Options;
  requestURL: string;
}) => {
  // get batch details which has ouptut file id
  // get file content as ReadableStream
  // return file content
  const baseUrl = OpenAIAPIConfig.getBaseURL({
    providerOptions,
    fn: 'retrieveBatch',
    env,
    gatewayRequestURL: requestURL,
  });
  const batchId = requestURL.split('/v1/batches/')[1].replace('/output', '');
  const retrieveBatchURL = `${baseUrl}/batches/${batchId}`;
  const retrieveBatchesHeaders = await OpenAIAPIConfig.headers({
    env,
    providerOptions,
    fn: 'retrieveBatch',
    transformedRequestBody: {},
    transformedRequestUrl: retrieveBatchURL,
    gatewayRequestBody: {},
  });
  const retrieveBatchesResponse = await fetch(retrieveBatchURL, {
    method: 'GET',
    headers: retrieveBatchesHeaders,
  });

  const batchDetails: RetrieveBatchResponse =
    await retrieveBatchesResponse.json();
  const outputFileId = batchDetails.output_file_id;
  if (!outputFileId) {
    const errors = batchDetails.errors;
    if (errors) {
      return new Response(JSON.stringify(errors), {
        status: 200,
      });
    }
  }
  const retrieveFileContentURL = `${baseUrl}/files/${outputFileId}/content`;
  const retrieveFileContentHeaders = await OpenAIAPIConfig.headers({
    env,
    providerOptions,
    fn: 'retrieveFileContent',
    transformedRequestBody: {},
    transformedRequestUrl: retrieveFileContentURL,
    gatewayRequestBody: {},
  });
  const response = fetch(retrieveFileContentURL, {
    method: 'GET',
    headers: retrieveFileContentHeaders,
  });
  return response;
};

export const BatchOutputResponseTransform = async (response: Response) => {
  return response;
};
