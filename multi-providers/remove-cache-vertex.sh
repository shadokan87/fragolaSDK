#!/bin/bash
sed -i '/const getFromCacheByKey = c.get('\''getFromCacheByKey'\'');/d' src/providers/google-vertex-ai/utils.ts
sed -i '/const resp = getFromCacheByKey/d' src/providers/google-vertex-ai/utils.ts
sed -i '/? await getFromCacheByKey(env(c), cacheKey)/d' src/providers/google-vertex-ai/utils.ts
sed -i '/: null;/d' src/providers/google-vertex-ai/utils.ts
sed -i '/if (resp) {/,/}/d' src/providers/google-vertex-ai/utils.ts
sed -i '/try {/,/catch (err) {}/d' src/providers/google-vertex-ai/utils.ts
sed -i '/const putInCacheWithValue = c.get('\''putInCacheWithValue'\'');/,/}/d' src/providers/google-vertex-ai/utils.ts
