import { PORTKEY_GATEWAY_URL, createHeaders } from "portkey-ai";
import { FragolaError } from "../exceptions";
import { Fragola } from "../fragola";

export const fragolaTest = new Fragola({
    apiKey: 'xxx',
    baseURL: PORTKEY_GATEWAY_URL,
    defaultHeaders: createHeaders({
        virtualKey: process.env["BEDROCK_DEV"],
        apiKey: process.env["PORTKEY_API_KEY"]
    })
});

export class TestFailError extends FragolaError {
    constructor(message: string) {
        super(message);
        this.name = "TestFailError";
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, TestFailError)
        }
    }
}