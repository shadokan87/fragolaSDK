import { createRouter as radixRouter } from "radix3";
import { endpointStrings } from "./providers/types";

export interface RouterPayload {
    endpoint?: endpointStrings;
    GET?: endpointStrings;
    POST?: endpointStrings;
    DELETE?: endpointStrings;
    PUT?: endpointStrings;
    PATCH?: endpointStrings;
}

export const createRouter = () => {
    const router = radixRouter<RouterPayload>();

    // Messages
    router.insert("/v1/messages", { endpoint: "messages", POST: "messages" });
    router.insert("/v1/messages/count_tokens", { endpoint: "messagesCountTokens", POST: "messagesCountTokens" });

    // Completions & Embeddings
    router.insert("/v1/chat/completions", { endpoint: "chatComplete", POST: "chatComplete" });
    router.insert("/v1/completions", { endpoint: "complete", POST: "complete" });
    router.insert("/v1/embeddings", { endpoint: "embed", POST: "embed" });

    // Images
    router.insert("/v1/images/generations", { endpoint: "imageGenerate", POST: "imageGenerate" });
    router.insert("/v1/images/edits", { endpoint: "imageEdit", POST: "imageEdit" });

    // Audio
    router.insert("/v1/audio/speech", { endpoint: "createSpeech", POST: "createSpeech" });
    router.insert("/v1/audio/transcriptions", { endpoint: "createTranscription", POST: "createTranscription" });
    router.insert("/v1/audio/translations", { endpoint: "createTranslation", POST: "createTranslation" });

    // Files
    router.insert("/v1/files", { GET: "listFiles", POST: "uploadFile" });
    router.insert("/v1/files/:id", { GET: "retrieveFile", DELETE: "deleteFile" });
    router.insert("/v1/files/:id/content", { endpoint: "retrieveFileContent", GET: "retrieveFileContent" });

    // Batches
    router.insert("/v1/batches", { GET: "listBatches", POST: "createBatch" });
    router.insert("/v1/batches/:id", { endpoint: "retrieveBatch", GET: "retrieveBatch" });
    router.insert("/v1/batches/:id/output", { endpoint: "getBatchOutput", GET: "getBatchOutput" });
    router.insert("/v1/batches/:id/cancel", { endpoint: "cancelBatch", POST: "cancelBatch" });

    // Responses
    router.insert("/v1/responses", { endpoint: "createModelResponse", POST: "createModelResponse" });
    router.insert("/v1/responses/:id", { GET: "getModelResponse", DELETE: "deleteModelResponse" });
    router.insert("/v1/responses/:id/input_items", { endpoint: "listResponseInputItems", GET: "listResponseInputItems" });

    // Fine-tuning
    router.insert("/v1/fine_tuning/jobs", { GET: "listFinetunes", POST: "createFinetune" });
    router.insert("/v1/fine_tuning/jobs/:jobId", { endpoint: "retrieveFinetune", GET: "retrieveFinetune" });
    router.insert("/v1/fine_tuning/jobs/:jobId/cancel", { endpoint: "cancelFinetune", POST: "cancelFinetune" });

    // Realtime
    router.insert("/v1/realtime", { endpoint: "realtime", GET: "realtime" });

    // Proxy & Catch-all mappings
    router.insert("/v1/prompts/**", { endpoint: "chatComplete", POST: "chatComplete" });
    router.insert("/v1/proxy/**", { endpoint: "proxy", GET: "proxy", POST: "proxy", DELETE: "proxy" });
    router.insert("/v1/**", { endpoint: "proxy", GET: "proxy", POST: "proxy", DELETE: "proxy" });

    return router;
}