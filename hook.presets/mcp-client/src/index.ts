import { tool, type Tool, type ToolHandlerReturnTypeNonAsync } from "@fragola-ai/agent";
import type { FragolaHook } from "@fragola-ai/agent/hook";
import { createStore } from "@fragola-ai/agent/store";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {type CallToolResult} from "@modelcontextprotocol/sdk/types.js";

import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import Ajv, { type Options as AjvOptions } from "ajv";

type MaybePromise<T> = Promise<T> | T;

export type McpClientFastConfig = {
  name: string;
  transport?: "Http" | "Stdio"
  connectionString: string;
  headers?: RequestInit["headers"];
};

export type McpClientData = {
  tools: Tool<any>[];
  ressources: Awaited<ReturnType<Client["listResources"]>>["resources"];
};

export type McpClientStoreType = {
  data: Map<string, McpClientData>;
};

export type McpClientCallback = (tools: Tool<any>[]) => MaybePromise<Tool<any>[]>;

export type McpClientToolResultProcessor = (result: CallToolResult) => ToolHandlerReturnTypeNonAsync;

export type McpClientOptions = {
  // client: McpClientFastConfig | Client;
  toolResultProcessor?: McpClientToolResultProcessor,
  schemaValidation?: AjvOptions;
  tools?: McpClientCallback;
} & (McpClientFastConfig
  | { client: Client; name: string }
  );

export type LoadedClient = {
  client: Client;
  closeOnDispose: boolean;
};

// function normalizeToolContent(content: unknown[]): string | unknown {
//   if (!Array.isArray(content) || content.length === 0)
//     return "";

//   if (content.length === 1 && (content[0] as ToolContent).type === "text")
//     return (content[0] as Extract<ToolContent, { type: "text" }>).text;

//   return content.map((item) => {
//     const toolContent = item as ToolContent;

//     switch (toolContent.type) {
//       case "text":
//         return { type: "text", text: toolContent.text };
//       case "image":
//         return {
//           type: "image",
//           mimeType: toolContent.mimeType,
//           data: `[base64 image: ${toolContent.data.substring(0, 50)}...]`,
//         };
//       case "resource":
//         return {
//           type: "resource",
//           uri: toolContent.resource.uri,
//           mimeType: toolContent.resource.mimeType,
//         };
//       default:
//         return item;
//     }
//   });
// }

async function connectClient(clientOrOptions: McpClientFastConfig | Client): Promise<LoadedClient> {
  if (clientOrOptions instanceof Client) {
    return {
      client: clientOrOptions,
      closeOnDispose: true,
    };
  }

  const resolvedTransport = clientOrOptions.transport ?? "Http";
  const client = new Client({
    name: clientOrOptions.name,
    version: "1.0",
  });

  const transport = resolvedTransport === "Stdio"
    ? new StdioClientTransport({
      command: clientOrOptions.connectionString,
      args: [],
    })
    : new StreamableHTTPClientTransport(new URL(clientOrOptions.connectionString), {
      requestInit: clientOrOptions.headers
        ? { headers: clientOrOptions.headers }
        : undefined,
    });

  await client.connect(transport);

  return {
    client,
    closeOnDispose: true,
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

async function listRemoteResources(client: Client) {
  const remoteResources: Awaited<ReturnType<typeof client.listResources>>["resources"] = [];
  let cursor: string | undefined;

  while (true) {
    const response = await client.listResources(cursor ? { cursor } : undefined);
    remoteResources.push(...response.resources);
    if (!response.nextCursor)
      break;
    cursor = response.nextCursor;
  }

  return remoteResources;
}

function createAjv(options: AjvOptions | undefined) {
  const ajv = new Ajv(options ?? {
    strict: false,
    removeAdditional: true,
    useDefaults: true,
    validateSchema: false, // Disable meta-schema validation to avoid HTTPS schema ref issues
    allErrors: true,
  });
  
  return ajv;
}

export const mcpClient = (options: McpClientOptions[] | McpClientOptions): FragolaHook => {
  return async (agent) => {
    const configuredOptions = Array.isArray(options) ? options : [options];
    const loadedClients: LoadedClient[] = [];
    const addedTools: Tool<any>[] = [];

    let store = agent.context.getStore<McpClientStoreType>("mcp-client");
    if (!store) {
      store = createStore<McpClientStoreType>({ data: new Map() }, "mcp-client");
      agent.context.addStore(store);
    }

    for (const option of configuredOptions) {
      const clientName = option.name;
      const client = (() => {
        if ("client" in option)
          return option.client;
        return {
          name: option.name,
          connectionString: option.connectionString,
          transport: option.transport,
          headers: option.headers,
        } as McpClientFastConfig;
      })();
      const loadedClient = await connectClient(client);
      loadedClients.push(loadedClient);

      const ajv = createAjv(option.schemaValidation);
      const remoteTools = await listRemoteTools(loadedClient.client).catch((e) => {
        console.warn(`Failed to list tools for ${clientName}:`, e.message);
        return [];
      });
      const remoteResources = await listRemoteResources(loadedClient.client).catch((e) => {
        console.warn(`Failed to list resources for ${clientName}:`, e.message);
        return [];
      });


      let mappedTools = remoteTools.map((remoteTool) => {
        let validator: ReturnType<typeof ajv.compile> | undefined;

        if (remoteTool.inputSchema) {
          try {
            validator = ajv.compile(remoteTool.inputSchema);
          } catch (error) {
            console.warn(`Failed to compile schema for tool ${remoteTool.name}:`, error instanceof Error ? error.message : error);
            // Continue without validation if schema compilation fails
          }
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
              arguments: params,
            });

            result.content

            if (result.isError) {
              const errorContent = result.content;
              throw new Error(`Tool ${remoteTool.name} returned error: ${typeof errorContent === "string" ? errorContent : JSON.stringify(errorContent)}`);
            }
            return option.toolResultProcessor ? option.toolResultProcessor(result as CallToolResult) : result;
            // return normalizeToolContent(result.content as unknown[]);
          },
        });
      });

      if (option.tools)
        mappedTools = await option.tools(mappedTools);

      store?.update((prev) => {
        const data = prev.data;
        data.set(clientName, {
          tools: mappedTools,
          ressources: remoteResources,
        });
        return { data };
      });

      addedTools.push(...mappedTools);
    }

    agent.context.updateTools((prev) => [...prev, ...addedTools]);

    return async () => {
      agent.context.updateTools((prev) => prev.filter((toolEntry) => !addedTools.includes(toolEntry)));
      agent.context.removeStore("mcp-client");

      await Promise.all(
        loadedClients
          .filter((loadedClient) => loadedClient.closeOnDispose)
          .map((loadedClient) => loadedClient.client.close()),
      );
    };
  };
};


export default mcpClient;