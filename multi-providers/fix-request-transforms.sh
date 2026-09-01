#!/bin/bash
# 1. modify transformToProviderRequestRequestBody signature call
sed -i 's/requestTransforms\[fn\](requestBody, requestHeaders)/requestTransforms[fn](requestBody, requestHeaders, providerOptions)/' src/services/transformToProviderRequest.ts

# 2. Fix fireworks-ai createFinetune
sed -i 's/export const FireworksRequestTransform = (/export const FireworksRequestTransform = (/' src/providers/fireworks-ai/createFinetune.ts
sed -i 's/requestHeaders: Record<string, string>/requestHeaders: Record<string, string>,\n  providerOptions: Options/' src/providers/fireworks-ai/createFinetune.ts
sed -i '/const providerOptions = constructConfigFromRequestHeaders(/,/as Options;/d' src/providers/fireworks-ai/createFinetune.ts
sed -i '/import { constructConfigFromRequestHeaders/d' src/providers/fireworks-ai/createFinetune.ts

# 3. Fix google-vertex-ai createBatch
sed -i 's/requestHeaders: Record<string, string>/requestHeaders: Record<string, string>,\n  providerOptions: Options/' src/providers/google-vertex-ai/createBatch.ts
sed -i '/const providerOptions = constructConfigFromRequestHeaders(requestHeaders);/d' src/providers/google-vertex-ai/createBatch.ts
sed -i '/import { constructConfigFromRequestHeaders/d' src/providers/google-vertex-ai/createBatch.ts
sed -i '/import { Options } from '\''..\/..\/types\/requestBody'\'';/!s/import {/import { Options } from '\''..\/..\/types\/requestBody'\'';\nimport {/' src/providers/google-vertex-ai/createBatch.ts

# 4. Fix azure-openai createBatch
sed -i 's/requestHeaders: Record<string, string>/requestHeaders: Record<string, string>,\n  providerOptions: Options/' src/providers/azure-openai/createBatch.ts
sed -i '/const providerOptions = constructConfigFromRequestHeaders(requestHeaders);/d' src/providers/azure-openai/createBatch.ts
sed -i '/import { constructConfigFromRequestHeaders/d' src/providers/azure-openai/createBatch.ts
sed -i '/import { Options } from '\''..\/..\/types\/requestBody'\'';/!s/import {/import { Options } from '\''..\/..\/types\/requestBody'\'';\nimport {/' src/providers/azure-openai/createBatch.ts
