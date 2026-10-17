import { Fragola, type ClientOptions } from "@fragola-ai/agent";
import 'dotenv/config';
export const defaultOpts: ClientOptions = {
    model: "deepseek-flash",
    apiKey: process.env["DEEPSEEK_API_KEY"],
    baseURL: "https://api.deepseek.com"
}
export const createTestClient = (opts?: ClientOptions) => {

  const _opts = opts ? { ...opts, ...defaultOpts } : defaultOpts;
  return new Fragola(_opts);
}