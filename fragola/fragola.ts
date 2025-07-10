import z from "zod";
import { Agent, type AgentOpt } from "./agent";
import type { maybePromise } from "./types";
import type { ClientOptions } from "openai/index.js";
import OpenAI from "openai/index.js";

export namespace Fragola {
}

export interface Tool<T extends z.ZodType<any, any>> {
    name: string,
    description: string,
    handler: ((parameters: z.infer<T>) => Promise<any>) | "dynamic",
    schema: T
}

export const tool = <T extends z.ZodType<any, any>>(params: Tool<T>) => params;

const test = tool({
    name: "test",
    description: "test",
    handler: "dynamic",
    schema: z.object({})
})

export class Fragola<TGlobalContext = {}> {
    private openai: OpenAI;
    constructor(clientOptions?: ClientOptions, private globalContext: TGlobalContext = {} as any) {
        this.openai = clientOptions ? new OpenAI(clientOptions) : new OpenAI();
    }

    Agent<TStore = {}>(opts: AgentOpt<TStore>): Agent<TGlobalContext, TStore> {
        return new Agent(opts, this.globalContext, this.openai);
    }
}