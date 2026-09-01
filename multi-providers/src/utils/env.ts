import { ProviderEnv } from '../types/env';

const isNodeInstance = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

let path: any;
let fs: any;
if (isNodeInstance) {
  path = await import('path');
  fs = await import('fs');
}

export function getValueOrFileContents(value?: string, ignore?: boolean) {
  if (!value || ignore) return value;

  try {
    // Check if value looks like a file path
    if (
      value.startsWith('/') ||
      value.startsWith('./') ||
      value.startsWith('../')
    ) {
      // Resolve the path (handle relative paths)
      const resolvedPath = path.resolve(value);

      // Check if file exists
      if (fs.existsSync(resolvedPath)) {
        // File exists, read and return its contents
        return fs.readFileSync(resolvedPath, 'utf8').trim();
      }
    }

    // If not a file path or file doesn't exist, return value as is
    return value;
  } catch (error: any) {
    console.log(`Error reading file at ${value}: ${error.message}`);
    // Return the original value if there's an error
    return value;
  }
}

const nodeEnv: ProviderEnv = {};
if (typeof process !== 'undefined' && process.env) {
  nodeEnv.NODE_ENV = getValueOrFileContents(process.env.NODE_ENV, true);
  nodeEnv.PORT = getValueOrFileContents(process.env.PORT) || '8787';

  nodeEnv.TLS_KEY_PATH = getValueOrFileContents(process.env.TLS_KEY_PATH, true);
  nodeEnv.TLS_CERT_PATH = getValueOrFileContents(process.env.TLS_CERT_PATH, true);
  nodeEnv.TLS_CA_PATH = getValueOrFileContents(process.env.TLS_CA_PATH, true);

  nodeEnv.AWS_ACCESS_KEY_ID = getValueOrFileContents(process.env.AWS_ACCESS_KEY_ID);
  nodeEnv.AWS_SECRET_ACCESS_KEY = getValueOrFileContents(
    process.env.AWS_SECRET_ACCESS_KEY
  );
  nodeEnv.AWS_SESSION_TOKEN = getValueOrFileContents(process.env.AWS_SESSION_TOKEN);
  nodeEnv.AWS_ROLE_ARN = getValueOrFileContents(process.env.AWS_ROLE_ARN);
  nodeEnv.AWS_PROFILE = getValueOrFileContents(process.env.AWS_PROFILE, true);
  nodeEnv.AWS_WEB_IDENTITY_TOKEN_FILE = getValueOrFileContents(
    process.env.AWS_WEB_IDENTITY_TOKEN_FILE,
    true
  );
  nodeEnv.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI = getValueOrFileContents(
    process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI,
    true
  );
  nodeEnv.AWS_ASSUME_ROLE_ACCESS_KEY_ID = getValueOrFileContents(
    process.env.AWS_ASSUME_ROLE_ACCESS_KEY_ID
  );
  nodeEnv.AWS_ASSUME_ROLE_SECRET_ACCESS_KEY = getValueOrFileContents(
    process.env.AWS_ASSUME_ROLE_SECRET_ACCESS_KEY
  );
  nodeEnv.AWS_ASSUME_ROLE_REGION = getValueOrFileContents(
    process.env.AWS_ASSUME_ROLE_REGION
  );
  nodeEnv.AWS_REGION = getValueOrFileContents(process.env.AWS_REGION);
  nodeEnv.AWS_ENDPOINT_DOMAIN = getValueOrFileContents(process.env.AWS_ENDPOINT_DOMAIN);
  nodeEnv.AWS_IMDS_V1 = getValueOrFileContents(process.env.AWS_IMDS_V1);

  nodeEnv.AZURE_AUTH_MODE = getValueOrFileContents(process.env.AZURE_AUTH_MODE);
  nodeEnv.AZURE_ENTRA_CLIENT_ID = getValueOrFileContents(
    process.env.AZURE_ENTRA_CLIENT_ID
  );
  nodeEnv.AZURE_ENTRA_CLIENT_SECRET = getValueOrFileContents(
    process.env.AZURE_ENTRA_CLIENT_SECRET
  );
  nodeEnv.AZURE_ENTRA_TENANT_ID = getValueOrFileContents(
    process.env.AZURE_ENTRA_TENANT_ID
  );
  nodeEnv.AZURE_MANAGED_CLIENT_ID = getValueOrFileContents(
    process.env.AZURE_MANAGED_CLIENT_ID
  );
  nodeEnv.AZURE_MANAGED_VERSION = getValueOrFileContents(
    process.env.AZURE_MANAGED_VERSION
  );
  nodeEnv.AZURE_IDENTITY_ENDPOINT = getValueOrFileContents(
    process.env.IDENTITY_ENDPOINT,
    true
  );
  nodeEnv.AZURE_MANAGED_IDENTITY_HEADER = getValueOrFileContents(
    process.env.IDENTITY_HEADER
  );
  nodeEnv.AZURE_AUTHORITY_HOST = getValueOrFileContents(
    process.env.AZURE_AUTHORITY_HOST
  );
  nodeEnv.AZURE_TENANT_ID = getValueOrFileContents(process.env.AZURE_TENANT_ID);
  nodeEnv.AZURE_CLIENT_ID = getValueOrFileContents(process.env.AZURE_CLIENT_ID);
  nodeEnv.AZURE_FEDERATED_TOKEN_FILE = getValueOrFileContents(
    process.env.AZURE_FEDERATED_TOKEN_FILE
  );

  nodeEnv.SSE_ENCRYPTION_TYPE = getValueOrFileContents(process.env.SSE_ENCRYPTION_TYPE);
  nodeEnv.KMS_KEY_ID = getValueOrFileContents(process.env.KMS_KEY_ID);
  nodeEnv.KMS_BUCKET_KEY_ENABLED = getValueOrFileContents(
    process.env.KMS_BUCKET_KEY_ENABLED
  );
  nodeEnv.KMS_ENCRYPTION_CONTEXT = getValueOrFileContents(
    process.env.KMS_ENCRYPTION_CONTEXT
  );
  nodeEnv.KMS_ENCRYPTION_ALGORITHM = getValueOrFileContents(
    process.env.KMS_ENCRYPTION_ALGORITHM
  );
  nodeEnv.KMS_ENCRYPTION_CUSTOMER_KEY = getValueOrFileContents(
    process.env.KMS_ENCRYPTION_CUSTOMER_KEY
  );
  nodeEnv.KMS_ENCRYPTION_CUSTOMER_KEY_MD5 = getValueOrFileContents(
    process.env.KMS_ENCRYPTION_CUSTOMER_KEY_MD5
  );
  nodeEnv.KMS_ROLE_ARN = getValueOrFileContents(process.env.KMS_ROLE_ARN);

  nodeEnv.HTTP_PROXY = getValueOrFileContents(process.env.HTTP_PROXY);
  nodeEnv.HTTPS_PROXY = getValueOrFileContents(process.env.HTTPS_PROXY);

  nodeEnv.APM_LOGGER = getValueOrFileContents(process.env.APM_LOGGER);

  nodeEnv.TRUSTED_CUSTOM_HOSTS = getValueOrFileContents(
    process.env.TRUSTED_CUSTOM_HOSTS
  );
}

export const Environment = (envObj?: ProviderEnv) => {
  if (isNodeInstance) {
    return { ...nodeEnv, ...envObj };
  }
  return envObj || {};
};
