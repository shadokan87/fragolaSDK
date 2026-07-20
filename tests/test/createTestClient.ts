import { PORTKEY_BASE_URL } from "portkey-ai/dist/src/constants";
import { Fragola, type ClientOptions } from "@fragola-ai/agent";
import 'dotenv/config';
export const defaultOpts: ClientOptions = {
    model: "@chainbridge/gemini-3-flash-preview",
    apiKey: process.env["TEST_API_KEY"],
    baseURL: PORTKEY_BASE_URL
}
export const createTestClient = (opts?: ClientOptions) => {

  const _opts = opts ? { ...opts, ...defaultOpts } : defaultOpts;
  return new Fragola(_opts);
}