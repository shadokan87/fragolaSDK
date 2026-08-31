export type AzureProviderOptions = {
    resourceName: string;
    deploymentId: string;
    apiVersion?: string;
    adAuth?: string;
    azureModelName?: string;
    azureApiVersion?: string;
    azureFoundryUrl?: string;
    azureExtraParameters?: string;
    azureDeploymentName?: string;
    azureEntraScope?: string;
} & (
    | { apiKey?: string }
    | { azureAdToken: string }
    | { azureAuthMode: 'entra', azureEntraTenantId: string, azureEntraClientId: string, azureEntraClientSecret: string }
    | { azureAuthMode: 'managed', azureManagedClientId: string }
    | { azureAuthMode: 'workload', azureWorkloadClientId: string }
);

export type AWSProviderOptions = {
    awsRegion: string;
    awsAuthType?: string;
    awsRoleArn?: string;
    awsExternalId?: string;
    awsS3Bucket?: string;
    awsS3ObjectKey?: string;
    awsBedrockModel?: string;
    awsServerSideEncryption?: string;
    awsServerSideEncryptionKMSKeyId?: string;
    awsService?: string;
    foundationModel?: string;
} & (
    | { awsSecretAccessKey: string, awsAccessKeyId: string, awsSessionToken?: string }
    | { apiKey?: string } 
    | {} 
);

export type SagemakerProviderOptions = AWSProviderOptions & {
    amznSagemakerCustomAttributes?: string;
    amznSagemakerTargetModel?: string;
    amznSagemakerTargetVariant?: string;
    amznSagemakerTargetContainerHostname?: string;
    amznSagemakerInferenceId?: string;
    amznSagemakerEnableExplanations?: string;
    amznSagemakerInferenceComponent?: string;
    amznSagemakerSessionId?: string;
    amznSagemakerModelName?: string;
};

export type AnthropicProviderOptions = {
    apiKey?: string;
    anthropicBeta?: string;
    anthropicVersion?: string;
    anthropicApiKey?: string;
};

export type GoogleVertexProviderOptions = {
    vertexRegion: string;
    vertexProjectId?: string;
    vertexStorageBucketName?: string;
    vertexModelName?: string;
    vertexBatchEndpoint?: any;
} & (
    | { apiKey?: string }
    | { vertexServiceAccountJson: Record<string, any> }
);

export type OpenAIProviderOptions = {
    apiKey?: string;
    openaiProject?: string;
    openaiOrganization?: string;
    openaiBeta?: string;
};

export type StabilityAIProviderOptions = {
    apiKey?: string;
    stabilityClientId?: string;
    stabilityClientUserId?: string;
    stabilityClientVersion?: string;
};

export type OracleProviderOptions = {
    oracleApiVersion?: string;
    oracleRegion: string;
    oracleCompartmentId?: string;
    oracleServingMode?: string;
    oracleTenancy: string;
    oracleUser: string;
    oracleFingerprint: string;
    oraclePrivateKey: string;
    oracleKeyPassphrase?: string;
};

export type FireworksAIProviderOptions = {
    apiKey?: string;
    fireworksAccountId?: string;
    fireworksFileLength?: string;
};

export type CortexProviderOptions = {
    apiKey?: string;
    snowflakeAccount?: string;
};

export type HuggingfaceProviderOptions = {
    apiKey?: string;
    huggingfaceBaseUrl?: string;
};

export type BaseProviderOptions = {
    apiKey?: string;
    customHost?: string;
};

export type ProviderName = 
    | "azure-openai"
    | "bedrock"
    | "sagemaker"
    | "anthropic"
    | "vertex-ai"
    | "openai"
    | "stability-ai"
    | "oracle"
    | "fireworks-ai"
    | "cortex"
    | "huggingface"
    | "cohere"
    | "anyscale"
    | "palm"
    | "together-ai"
    | "google"
    | "perplexity-ai"
    | "mistral-ai"
    | "deepinfra"
    | "ncompass"
    | "nomic"
    | "ollama"
    | "ai21"
    | "groq"
    | "segmind"
    | "jina"
    | "workers-ai"
    | "reka-ai"
    | "moonshot"
    | "openrouter"
    | "lingyi"
    | "zhipu"
    | "novita-ai"
    | "monsterapi"
    | "deepseek"
    | "predibase"
    | "triton"
    | "voyage"
    | "azure-ai-inference"
    | "deepbricks"
    | "siliconflow"
    | "cerebras"
    | "inference-net"
    | "sambanova"
    | "lemonfox-ai"
    | "upstage"
    | "lambda"
    | "dashscope"
    | "x-ai"
    | "qdrant"
    | "nebius"
    | "recraft-ai"
    | "milvus"
    | "replicate"
    | "lepton"
    | "kluster-ai"
    | "nscale"
    | "hyperbolic"
    | "featherless-ai"
    | "krutrim"
    | "302ai"
    | "meshy"
    | "tripo3d"
    | "nextbit"
    | "cometapi"
    | "z-ai"
    | "matterai"
    | "modal"
    | "iointelligence"
    | "aibadgr"
    | "ovhcloud"
    | (string & {});

export type Provider<K extends ProviderName> = 
    K extends "azure-openai" ? AzureProviderOptions :
    K extends "bedrock" ? AWSProviderOptions :
    K extends "sagemaker" ? SagemakerProviderOptions :
    K extends "anthropic" ? AnthropicProviderOptions :
    K extends "vertex-ai" ? GoogleVertexProviderOptions :
    K extends "openai" ? OpenAIProviderOptions :
    K extends "stability-ai" ? StabilityAIProviderOptions :
    K extends "oracle" ? OracleProviderOptions :
    K extends "fireworks-ai" ? FireworksAIProviderOptions :
    K extends "cortex" ? CortexProviderOptions :
    K extends "huggingface" ? HuggingfaceProviderOptions :
    BaseProviderOptions;

// export type Model<K extends ProviderName = ProviderName> = K extends string & {} ? `@${K}/${string}` : never;
// export const model = <K extends ProviderName>(name: K) => name;
// const test = model("@302ai/test") 