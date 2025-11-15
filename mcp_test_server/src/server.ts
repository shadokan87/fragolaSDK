import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

// Simple in-memory database
export type Client = {
  id: string;
  name: string;
};

const clients: Client[] = [];

// Create the MCP server instance
const server = new McpServer({
  name: 'test-mcp-server',
  version: '0.1.0'
});

// Tools
server.registerTool(
  'list_clients',
  {
    title: 'List Clients',
    description: 'Return the list of clients in the in-memory database',
    inputSchema: {},
    outputSchema: {
      count: z.number(),
      clients: z.array(z.object({ id: z.string(), name: z.string() }))
    }
  },
  async () => {
    const output = { count: clients.length, clients: [...clients] };
    return {
      content: [
        { type: 'text', text: JSON.stringify(output, null, 2) }
      ],
      structuredContent: output
    };
  }
);

server.registerTool(
  'add_client',
  {
    title: 'Add Client',
    description: 'Add a client to the in-memory database',
    inputSchema: { name: z.string().min(1) },
    outputSchema: {
      success: z.literal(true),
      client: z.object({ id: z.string(), name: z.string() })
    }
  },
  async ({ name }) => {
    const client: Client = { id: randomUUID(), name };
    clients.push(client);
    const output = { success: true as const, client };
    return {
      content: [
        { type: 'text', text: JSON.stringify(output, null, 2) }
      ],
      structuredContent: output
    };
  }
);

server.registerTool(
  'remove_client',
  {
    title: 'Remove Client',
    description: 'Remove a client from the in-memory database by id',
    inputSchema: { id: z.string().min(1) },
    outputSchema: {
      success: z.boolean(),
      removed: z.object({ id: z.string(), name: z.string() }).optional()
    }
  },
  async ({ id }) => {
    const idx = clients.findIndex(c => c.id === id);
    if (idx === -1) {
      const output = { success: false as const };
      return {
        content: [
          { type: 'text', text: JSON.stringify(output, null, 2) }
        ],
        structuredContent: output,
        isError: true
      };
    }
    const [removed] = clients.splice(idx, 1);
    const output = { success: true as const, removed };
    return {
      content: [
        { type: 'text', text: JSON.stringify(output, null, 2) }
      ],
      structuredContent: output
    };
  }
);

// HTTP server using Streamable HTTP transport (remote, not stdio)
const app = express();
app.use(express.json());

// Stateless: create a new transport per request
app.post('/mcp', async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    res.on('close', () => {
      transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null
      });
    }
  }
});

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`Remote MCP server listening at http://localhost:${PORT}/mcp`);
});
