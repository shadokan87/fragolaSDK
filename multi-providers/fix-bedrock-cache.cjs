const fs = require('fs');
const file = 'src/providers/bedrock/utils.ts';
let code = fs.readFileSync(file, 'utf8');

// Replace Context with ProviderEnv
code = code.replace(/import \{ Context \} from 'hono';/, "import { ProviderEnv } from '../../types/env';");
code = code.replace(/c: Context/g, "env: ProviderEnv");
code = code.replace(/env\(c\)/g, "env");

// Remove cache logic
code = code.replace(/const getFromCacheByKey = [\s\S]*?if \(resp\) \{\s*return resp;\s*\}/g, "");
code = code.replace(/if \(putInCacheWithValue && cacheKey\) \{\s*await putInCacheWithValue\(env, cacheKey, credentials, 300\);\s*\/\/[^\n]*\s*\}/g, "");
code = code.replace(/const getFromCacheByKey = c\.get\('getFromCacheByKey'\);\s*const putInCacheWithValue = c\.get\('putInCacheWithValue'\);\s*const cacheKey = [^;]*;\s*const cachedFoundationModel = [^;]*\? await getFromCacheByKey\([^;]*\s*: null;\s*if \(cachedFoundationModel\) \{\s*return cachedFoundationModel;\s*\}/g, "");
code = code.replace(/if \(putInCacheWithValue\) \{\s*putInCacheWithValue\(env, cacheKey, foundationModel, 86400\);\s*\}/g, "");
// Remove hono/adapter import
code = code.replace(/import \{ env \} from 'hono\/adapter';\n/, "");

fs.writeFileSync(file, code);
