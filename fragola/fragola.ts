import z from "zod";
import { Agent, type AgentOpt, type StoreLike } from "./agent";
import type { maybePromise } from "./types";
import type { ClientOptions } from "openai/index.js";
import OpenAI from "openai/index.js";
import type { Store } from "./store";

export namespace Fragola {
}

export type GetStore = <T extends StoreLike<any>>() => Store<T> | undefined;

export interface Tool<T extends z.ZodType<any, any>> {
    name: string,
    description: string,
    namespace?: string,
    handler: ((parameters: z.infer<T>, getStore: GetStore, getGlobalStore: GetStore) => Promise<any>) | "dynamic",
    schema: T
}

export const tool = <T extends z.ZodType<any, any>>(params: Tool<T>) => params;

const test = tool({
    name: "test",
    description: "test",
    handler: "dynamic",
    schema: z.object({})
})

export class Fragola<TGlobalStore = {}> {
    private openai: OpenAI;
    constructor(clientOptions?: ClientOptions,private globalStore: Store<StoreLike<TGlobalStore>> | undefined = undefined ) {
        this.openai = clientOptions ? new OpenAI(clientOptions) : new OpenAI();
    }

    Agent<TStore = {}>(opts: AgentOpt<TStore>): Agent<TGlobalStore, TStore> {
        return new Agent(opts, this.globalStore, this.openai);
    }
}