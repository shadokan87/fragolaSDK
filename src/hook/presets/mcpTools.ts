import type { FragolaHook } from "..";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import Ajv, { type Options as AjvOptions } from "ajv";
import { tool, type Tool } from "@src/fragola";
import type { maybePromise } from "@src/types";

export type McpClientOptions = {
    name: string,
    url: string
}

export type McpToolsCallback = (tools: Tool<any>[]) => maybePromise<Tool<any>[]>;

export type McpToolsOptions = {
    client: McpClientOptions | Client;
    schemaValidation?: AjvOptions;
    /**
     * Receives the tools loaded from the MCP server and returns the tools that should be registered on the agent.
     */
    tools?: McpToolsCallback;
}

type LoadedClient = {
    client: Client;
    closeOnDispose: boolean;
};

type ToolContent =
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
    | { type: "resource"; resource: { uri: string; mimeType?: string; text?: string; blob?: string } };

function normalizeToolContent(content: unknown[]): string | unknown {
    if (!Array.isArray(content) || content.length === 0) {
        return "";
    }

    if (content.length === 1 && (content[0] as ToolContent).type === "text") {
        return (content[0] as Extract<ToolContent, { type: "text" }>).text;
    }

    return content.map((item) => {
        const toolContent = item as ToolContent;

        switch (toolContent.type) {
            case "text":
                return { type: "text", text: toolContent.text };
            case "image":
                return {
                    type: "image",
                    mimeType: toolContent.mimeType,
                    data: `[base64 image: ${toolContent.data.substring(0, 50)}...]`
                };
            case "resource":
                return {
                    type: "resource",
                    uri: toolContent.resource.uri,
                    mimeType: toolContent.resource.mimeType
                };
            default:
                return item;
        }
    });
}

async function connectClient(clientOrOptions: McpClientOptions | Client): Promise<LoadedClient> {
    if (clientOrOptions instanceof Client) {
        return {
            client: clientOrOptions,
            closeOnDispose: false
        };
    }

    const transport = new StreamableHTTPClientTransport(new URL(clientOrOptions.url));
    const client = new Client({
        name: clientOrOptions.name,
        version: "1.0",
    });

    await client.connect(transport);

    return {
        client,
        closeOnDispose: true
    };
}

async function listRemoteTools(client: Client) {
    const remoteTools: Awaited<ReturnType<typeof client.listTools>>["tools"] = [];
    let cursor: string | undefined;

    while (true) {
        const response = await client.listTools(cursor ? { cursor } : undefined);
        remoteTools.push(...response.tools);
        if (!response.nextCursor)
            break;
        cursor = response.nextCursor;
    }

    return remoteTools;
}

function createAjv(options: AjvOptions | undefined) {
    return new Ajv(options ?? {
        strict: false,
        removeAdditional: true,
        useDefaults: true
    });
}

export const mcpTools = (options: McpToolsOptions[] | McpToolsOptions): FragolaHook => {
    return async (agent) => {
        const configuredOptions = Array.isArray(options) ? options : [options];
        const loadedClients: LoadedClient[] = [];
        const addedTools: Tool<any>[] = [];

        for (const option of configuredOptions) {
            const loadedClient = await connectClient(option.client);
            loadedClients.push(loadedClient);

            const ajv = createAjv(option.schemaValidation);
            const remoteTools = await listRemoteTools(loadedClient.client);

            let mappedTools = remoteTools.map((remoteTool) => {
                let validator: ReturnType<typeof ajv.compile> | undefined;

                if (remoteTool.inputSchema) {
                    validator = ajv.compile(remoteTool.inputSchema);
                }

                return tool({
                    name: remoteTool.name,
                    description: remoteTool.description || "Remote MCP tool",
                    schema: remoteTool.inputSchema ? JSON.stringify(remoteTool.inputSchema) : undefined,
                    handler: async (params) => {
                        if (validator) {
                            const isValid = validator(params);
                            if (!isValid) {
                                throw new Error(`Invalid parameters for tool ${remoteTool.name}: ${JSON.stringify(validator.errors)}`);
                            }
                        }

                        const result = await loadedClient.client.callTool({
                            name: remoteTool.name,
                            arguments: params
                        });

                        if (result.isError) {
                            const errorContent = normalizeToolContent(result.content as unknown[]);
                            throw new Error(`Tool ${remoteTool.name} returned error: ${typeof errorContent === "string" ? errorContent : JSON.stringify(errorContent)}`);
                        }

                        return normalizeToolContent(result.content as unknown[]);
                    }
                });
            });

            if (option.tools) {
                mappedTools = await option.tools(mappedTools);
            }

            addedTools.push(...mappedTools);
        }

        agent.context.updateTools((prev) => [...prev, ...addedTools]);

        return async () => {
            agent.context.updateTools((prev) => prev.filter((toolEntry) => !addedTools.includes(toolEntry)));

            await Promise.all(
                loadedClients
                    .filter((loadedClient) => loadedClient.closeOnDispose)
                    .map((loadedClient) => loadedClient.client.close())
            );
        };
    };
}

export const mcpClient = mcpTools;