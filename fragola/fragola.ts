import z from "zod";
import { Agent, type AgentContext, type CreateAgentOptions } from "./agent";
import type { maybePromise, StoreLike } from "./types";
import type { ClientOptions } from "openai/index.js";
import OpenAI from "openai/index.js";
import type { Store } from "./store";

export type ToolHandlerReturnTypeNonAsync = any[] | Record<any, any> | Function | number | bigint | boolean;
export type ToolHandlerReturnType = maybePromise<ToolHandlerReturnTypeNonAsync>;

export interface Tool<T extends z.ZodType<any, any>> {
    /**
     * The name of the tool.
     */
    name: string;
    /**
     * A detailed description of the tool's purpose.
     */
    description: string;
    /**
     * The function that handles the tool's logic, or the string "dynamic" for dynamic handlers.
     */
    handler: ((parameters: z.infer<T>, context: AgentContext<any, any>) => ToolHandlerReturnType) | "dynamic";
    /**
     * The Zod schema that validates the parameters for the tool.
     */
    schema: T;
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