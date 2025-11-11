import type { FragolaHook, FragolaHookDispose } from "..";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createStore } from "@src/store";
// Notifications
import { type ToolListChangedNotification } from "@modelcontextprotocol/sdk/types.js";
import { type Implementation } from "@modelcontextprotocol/sdk/types.js";
import z from "zod";
import { tool, type Tool } from "@src/fragola";
import Ajv from "ajv"; // Add AJV import

// Initialize AJV
const ajv = new Ajv({
    strict: false, // Allow additional properties
    removeAdditional: true, // Remove properties not defined in schema
    useDefaults: true // Use default values from schema
});

type McpClientOptions = {
    name: string,
    url: string
}
type NotificationBase = {
    method: string;
    params?: {
        [x: string]: unknown;
        _meta?: {
            [x: string]: unknown;
        } | undefined;
    } | undefined;
}

export const storeNamespace = "mcpClient";

export type storeType = {
    clients: Map<string, Client>
}
type options = McpClientOptions | Client;
const mcpClient = (options: options[]): FragolaHook => {
    return async (agent) => {
        // Init store
        if (!agent.context.getStore(storeNamespace)) {
            agent.context.addStore(createStore<storeType>({
                clients: new Map()
            }, storeNamespace))
        }
        const single = async (opt: options) => {
            let client: Client;
            if (opt instanceof Client) {

            } else {
                const transport = new StreamableHTTPClientTransport(new URL(opt.url));
                client = new Client({
                    name: opt.name,
                    version: "1.0",
                    transport: transport
                })
            }
            type RemoteTool = Awaited<ReturnType<typeof client.listTools>>["tools"];
            let remoteTools: RemoteTool[0][] = [];
            const syncRemoteTools = async () => {
                let cursor: string | undefined;
                while (true) {
                    try {
                        const response = await client.listTools(cursor ? { cursor } : undefined);
                        remoteTools = [...remoteTools, ...response.tools]
                        if (!response.nextCursor)
                            break;
                        else
                            cursor = response.nextCursor;
                    } catch (e) {
                        console.error(e);
                        break;
                    }
                }
                let fragolaTools: Tool<any>[] = [];
                remoteTools.forEach(remoteTool => {
                    // Create AJV validator from JSON schema
                    let validator: any = null;
                    if (remoteTool.inputSchema) {
                        try {
                            validator = ajv.compile(remoteTool.inputSchema);
                        } catch (error) {
                            console.warn(`Failed to compile schema for tool ${remoteTool.name}:`, error);
                        }
                    }

                    fragolaTools = [...fragolaTools, tool({
                        name: remoteTool.name,
                        description: remoteTool.description || "Remote mcp tool",
                        handler: async (params) => {
                            // Validate parameters using AJV
                            if (validator) {
                                const isValid = validator(params);
                                if (!isValid) {
                                    throw new Error(`Invalid parameters for tool ${remoteTool.name}: ${JSON.stringify(validator.errors)}`);
                                }
                            }
                            
                            // Call the remote MCP tool
                            try {
                                const result = await client.callTool({
                                    name: remoteTool.name,
                                    arguments: params
                                });
                                return result.content;
                            } catch (error) {
                                console.error(`Error calling MCP tool ${remoteTool.name}:`, error);
                                throw error;
                            }
                        }
                    })]
                });
                
                // Register tools with agent
                agent.context.updateTools((prev) => [...prev, ...fragolaTools]);
            }
            await syncRemoteTools();
            const method = <T extends NotificationBase>(payload: T) => {
                return z.object({
                    method: z.literal(payload.method),
                    params: payload.params ? z.any() : z.undefined().optional()
                });
            };

            tools: {
                const toolListChanged = method<ToolListChangedNotification>({ method: "notifications/tools/list_changed" });
                client!.setNotificationHandler(toolListChanged, async () => {
                    agent.context.updateTools((prev) => prev.filter(p => remoteTools.some(r => r.name == p.name)));
                    await syncRemoteTools();
                });
            }
        };

        const dispose: FragolaHookDispose = () => {

        };
    }
}