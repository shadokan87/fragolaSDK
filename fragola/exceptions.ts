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