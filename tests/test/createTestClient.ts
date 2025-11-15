import { createHeaders, PORTKEY_GATEWAY_URL } from 'portkey-ai';
import { Fragola, type ClientOptions } from "@fragola-ai/agentic-sdk-core";

export const createTestClient = (opts?: ClientOptions) => {
    const defaultOpts: ClientOptions = {
        baseURL: PORTKEY_GATEWAY_URL,
        defaultHeaders: createHeaders({
            virtualKey: "google-966377",
            apiKey: process.env["TEST_API_KEY"]
        }),
        model: process.env["TEST_MODEL_MEDIUM"]!
    }
    return new Fragola(opts ? {...opts, ...defaultOpts} : defaultOpts);
}