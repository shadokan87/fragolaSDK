import type { AgentAny } from "./agent";

// Base exception class
export class FragolaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FragolaError';
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, FragolaError);
        }
    }
}

export class MaxStepHitError extends FragolaError {
    constructor(message: string) {
        super(message);
        this.name = "MaxStepHitError";
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, MaxStepHitError)
        }
    }
}

export class BadUsage extends FragolaError {
    constructor(message: string) {
        super(message);
        this.name = "BadUsage";
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, BadUsage)
        }
    }
}

export class JsonModeError extends FragolaError {
    constructor(message: string) {
        super(message);
        this.name = "JsonModeError";
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, JsonModeError)
        }
    }
}