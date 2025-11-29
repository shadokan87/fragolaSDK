import type { FragolaHook, FragolaHookDispose } from "..";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createStore } from "@src/store";
// Notifications
import {
    type ToolListChangedNotification,
    type ResourceListChangedNotification,
    type ResourceUpdatedNotification,
    type PromptListChangedNotification,
    type ProgressNotification,
    type LoggingMessageNotification,
    type CancelledNotification,
    type Implementation
} from "@modelcontextprotocol/sdk/types.js";
import z from "zod";
import { tool, type Tool } from "@src/fragola";
import Ajv, { type Options as AjvOptions } from "ajv";

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
type NotificationParams = Pick<NotificationBase, "params">;

export const storeNamespace = "mcpClient";

// Tool content types from MCP spec
export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image"; data: string; mimeType: string };
export type ResourceContent = { type: "resource"; resource: { uri: string; mimeType?: string; text?: string; blob?: string } };
export type ToolContent = TextContent | ImageContent | ResourceContent;

// Tool annotations from MCP spec
export type ToolAnnotations = {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
};

// Progress callback type
export type ProgressCallback = (progress: number, total?: number, message?: string) => void;

// Log level type
export type LogLevel = "debug" | "info" | "notice" | "warning" | "error" | "critical" | "alert" | "emergency";
export type LogCallback = (level: LogLevel, logger?: string, data?: unknown) => void;

export type storeType = {
    clients: Map<string, Client>;
    resources: Map<string, { uri: string; name: string; mimeType?: string }[]>;
    prompts: Map<string, { name: string; description?: string }[]>;
}

type options = {
    client: McpClientOptions | Client;
    schemaValidation?: AjvOptions;
    onProgress?: ProgressCallback;
    onLog?: LogCallback;
    onResourcesChanged?: (clientName: string) => void;
    onResourceUpdated?: (uri: string) => void;
    onPromptsChanged?: (clientName: string) => void;
    onCancelled?: (requestId: string | number, reason?: string) => void;
}

/**
 * Normalize MCP tool result content to a string or structured data
 */
function normalizeToolContent(content: unknown[]): string | unknown {
    if (!Array.isArray(content) || content.length === 0) {
        return "";
    }

    // If single text content, return just the text
    if (content.length === 1 && (content[0] as ToolContent).type === "text") {
        return (content[0] as TextContent).text;
    }

    // For multiple items or non-text, return structured
    return content.map((item) => {
        const c = item as ToolContent;
        switch (c.type) {
            case "text":
                return { type: "text", text: c.text };
            case "image":
                return { type: "image", mimeType: c.mimeType, data: `[base64 image: ${c.data.substring(0, 50)}...]` };
            case "resource":
                return { type: "resource", uri: c.resource.uri, mimeType: c.resource.mimeType };
            default:
                return item;
        }
    });
}

export const mcpClient = (options: options[] | options): FragolaHook => {
    return async (agent) => {
        // Init store
        if (!agent.context.getStore(storeNamespace)) {
            agent.context.addStore(createStore<storeType>({
                clients: new Map(),
                resources: new Map(),
                prompts: new Map()
            }, storeNamespace))
        } else {
            throw new Error(`Store namespace '${storeNamespace}' is taken.`)
        }
        const allClients: Client[] = [];
        // Track tool names per client for proper cleanup
        const toolNamesByClient: Map<Client, string[]> = new Map();

        const single = async (opt: options) => {
            let client: Client;
            let clientName: string;

            if (opt.client instanceof Client) {
                client = opt.client;
                clientName = "external-client";
                allClients.push(client);
            } else {
                const transport = new StreamableHTTPClientTransport(new URL(opt.client.url));
                client = new Client({
                    name: opt.client.name,
                    version: "1.0",
                });
                clientName = opt.client.name;
                allClients.push(client);
                await client.connect(transport);
            }

            // Store client reference
            const store = agent.context.getStore<storeType>(storeNamespace);
            store?.value.clients.set(clientName, client);

            type RemoteTool = Awaited<ReturnType<typeof client.listTools>>["tools"][0];
            let remoteTools: RemoteTool[] = [];

            const syncRemoteTools = async () => {
                // Clear previous tools for this client before re-syncing
                remoteTools = [];
                let cursor: string | undefined;

                while (true) {
                    try {
                        const response = await client.listTools(cursor ? { cursor } : undefined);
                        remoteTools = [...remoteTools, ...response.tools];
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
                const newToolNames: string[] = [];

                for (const remoteTool of remoteTools) {
                    // Create AJV validator from JSON schema
                    let validator: any = null;
                    if (remoteTool.inputSchema) {
                        try {
                            validator = new Ajv(opt.schemaValidation ?? {
                                strict: false,
                                removeAdditional: true,
                                useDefaults: true
                            }).compile(remoteTool.inputSchema);
                        } catch (error) {
                            console.warn(`Failed to compile schema for tool ${remoteTool.name}:`, error);
                        }
                    }

                    // Extract annotations if present
                    const annotations: ToolAnnotations | undefined = (remoteTool as any).annotations;

                    // Build description with annotations info
                    let description = remoteTool.description || "Remote MCP tool";
                    if (annotations) {
                        const hints: string[] = [];
                        if (annotations.readOnlyHint) hints.push("read-only");
                        if (annotations.destructiveHint) hints.push("destructive");
                        if (annotations.idempotentHint) hints.push("idempotent");
                        if (annotations.openWorldHint) hints.push("open-world");
                        if (hints.length > 0) {
                            description += ` [${hints.join(", ")}]`;
                        }
                    }

                    newToolNames.push(remoteTool.name);

                    fragolaTools = [...fragolaTools, tool({
                        name: remoteTool.name,
                        description,
                        schema: remoteTool.inputSchema ? JSON.stringify(remoteTool.inputSchema) : undefined,
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

                                // Handle isError flag from MCP response
                                if (result.isError) {
                                    const errorContent = normalizeToolContent(result.content as unknown[]);
                                    throw new Error(`Tool ${remoteTool.name} returned error: ${typeof errorContent === "string" ? errorContent : JSON.stringify(errorContent)}`);
                                }

                                // Normalize and return content
                                return normalizeToolContent(result.content as unknown[]);
                            } catch (error) {
                                console.error(`Error calling MCP tool ${remoteTool.name}:`, error);
                                throw error;
                            }
                        }
                    })];
                }

                // Remove old tools for this client, then add new ones
                const oldToolNames = toolNamesByClient.get(client) || [];
                agent.context.updateTools((prev) =>
                    prev.filter(t => !oldToolNames.includes(t.name))
                );
                toolNamesByClient.set(client, newToolNames);

                // Register new tools
                agent.context.updateTools((prev) => [...prev, ...fragolaTools]);
            };

            await syncRemoteTools();

            // Helper to create notification schemas
            const method = <T extends NotificationBase>(payload: T) => {
                return z.object({
                    method: z.literal(payload.method),
                    params: payload.params ? z.any() : z.undefined().optional()
                });
            };

            // ===== NOTIFICATION HANDLERS =====

            // 1. Tools list changed
            client.setNotificationHandler(
                method<ToolListChangedNotification>({ method: "notifications/tools/list_changed" }),
                async () => {
                    await syncRemoteTools();
                }
            );

            // 2. Resources list changed
            client.setNotificationHandler(
                method<ResourceListChangedNotification>({ method: "notifications/resources/list_changed" }),
                async () => {
                    try {
                        const response = await client.listResources();
                        store?.value.resources.set(clientName, response.resources.map(r => ({
                            uri: r.uri,
                            name: r.name,
                            mimeType: r.mimeType
                        })));
                        opt.onResourcesChanged?.(clientName);
                    } catch (e) {
                        console.error("Failed to sync resources:", e);
                    }
                }
            );

            // 3. Resource updated
            client.setNotificationHandler(
                method<ResourceUpdatedNotification>({ method: "notifications/resources/updated", params: { uri: "" } }),
                async (notification) => {
                    const uri = (notification as any).params?.uri;
                    if (uri) {
                        opt.onResourceUpdated?.(uri);
                    }
                }
            );

            // 4. Prompts list changed
            client.setNotificationHandler(
                method<PromptListChangedNotification>({ method: "notifications/prompts/list_changed" }),
                async () => {
                    try {
                        const response = await client.listPrompts();
                        store?.value.prompts.set(clientName, response.prompts.map(p => ({
                            name: p.name,
                            description: p.description
                        })));
                        opt.onPromptsChanged?.(clientName);
                    } catch (e) {
                        console.error("Failed to sync prompts:", e);
                    }
                }
            );

            // 5. Progress notification
            client.setNotificationHandler(
                method<ProgressNotification>({ method: "notifications/progress", params: { progress: 0, progressToken: "" } }),
                async (notification) => {
                    const params = (notification as any).params;
                    if (params && opt.onProgress) {
                        opt.onProgress(params.progress, params.total, params.message);
                    }
                }
            );

            // 6. Logging message
            client.setNotificationHandler(
                method<LoggingMessageNotification>({ method: "notifications/message", params: { level: "info", data: "" } }),
                async (notification) => {
                    const params = (notification as any).params;
                    if (params && opt.onLog) {
                        opt.onLog(params.level as LogLevel, params.logger, params.data);
                    }
                }
            );

            // 7. Cancelled notification
            client.setNotificationHandler(
                method<CancelledNotification>({ method: "notifications/cancelled", params: { requestId: "" } }),
                async (notification) => {
                    const params = (notification as any).params;
                    if (params && opt.onCancelled) {
                        opt.onCancelled(params.requestId, params.reason);
                    }
                }
            );
        };

        // Process ALL options, not just the first one
        const _options = Array.isArray(options) ? options : [options];
        for (const opt of _options) {
            await single(opt);
        }

        return async () => {
            agent.context.removeStore(storeNamespace);
            for (const client of allClients) {
                await client.close();
            }
        }
    }
}