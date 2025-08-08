import z from "zod";
import { Agent, type CreateAgentOptions } from "./agent";
import type { maybePromise, StoreLike } from "./types";
import type { ClientOptions } from "openai/index.js";
import OpenAI from "openai/index.js";
import type { Store } from "./store";

export type GetStore = <TStore extends StoreLike<any>>() => Store<TStore> | undefined;

export interface Tool<T extends z.ZodType<any, any>> {
    name: string,
    description: string,
    namespace?: string,
    handler: ((parameters: z.infer<T>, getStore: GetStore, getGlobalStore: GetStore) => maybePromise<any>) | "dynamic",
    schema: T
}

export const tool = <T extends z.ZodType<any, any>>(params: Tool<T>) => params;

export class Fragola<TGlobalStore = {}> {
    private openai: OpenAI;
    constructor(clientOptions?: ClientOptions, private globalStore: Store<TGlobalStore> | undefined = undefined) {
        this.openai = clientOptions ? new OpenAI(clientOptions) : new OpenAI();
    }

    agent<TStore = {}>(opts: CreateAgentOptions<TStore>): Agent<TGlobalStore, TStore> {
        return new Agent<TGlobalStore, TStore>(opts, this.globalStore, this.openai);
    }
}