#!/bin/bash
sed -i 's/env(c)/env/g' src/providers/sagemaker/api.ts
sed -i 's/env(c)/env/g' src/providers/bedrock/utils.ts
sed -i '/import { env } from '\''hono\/adapter'\'';/d' src/providers/sagemaker/api.ts
sed -i '/import { env } from '\''hono\/adapter'\'';/d' src/providers/bedrock/utils.ts

# Remove caching from bedrock/utils.ts
sed -i '/const getFromCacheByKey = c.get('\''getFromCacheByKey'\'');/d' src/providers/bedrock/utils.ts
sed -i '/const resp = getFromCacheByKey/d' src/providers/bedrock/utils.ts
sed -i '/? await getFromCacheByKey(env, cacheKey)/d' src/providers/bedrock/utils.ts
sed -i '/: null;/d' src/providers/bedrock/utils.ts
sed -i '/if (resp) {/,/}/d' src/providers/bedrock/utils.ts
sed -i '/try {/,/catch (err) {}/d' src/providers/bedrock/utils.ts
sed -i '/const putInCacheWithValue = c.get('\''putInCacheWithValue'\'');/,/}/d' src/providers/bedrock/utils.ts

# Fix handlerUtils.ts
sed -i 's/env(c)/env/g' src/handlers/handlerUtils.ts
sed -i '/import { env } from '\''hono\/adapter'\'';/d' src/handlers/handlerUtils.ts

# Fix Context -> env in handlerUtils
sed -i 's/c: Context/env: ProviderEnv/g' src/handlers/handlerUtils.ts
sed -i 's/import { Context } from '\''hono'\'';/import { ProviderEnv } from '\''..\/types\/env'\'';/g' src/handlers/handlerUtils.ts
