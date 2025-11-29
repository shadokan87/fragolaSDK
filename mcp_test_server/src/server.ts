import express from 'express';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';

// Simple in-memory database
export type Client = {
  id: string;
  name: string;
};

const clients: Client[] = [];

// In-memory resources
const resources: Map<string, { content: string; mimeType: string }> = new Map([
  ['config', { content: JSON.stringify({ version: '1.0', debug: true }), mimeType: 'application/json' }],
  ['readme', { content: '# Test MCP Server\n\nThis is a test server for MCP client development.', mimeType: 'text/markdown' }]
]);

// In-memory prompts
const prompts: Map<string, { description: string; template: string }> = new Map([
  ['greeting', { description: 'Generate a greeting message', template: 'Hello, {{name}}! Welcome to the MCP test server.' }],
  ['summary', { description: 'Summarize the clients database', template: 'There are {{count}} clients in the database.' }]
]);

// Track active transports for notifications
const activeTransports: Set<StreamableHTTPServerTransport> = new Set();

// Create the MCP server instance
const server = new McpServer({
  name: 'test-mcp-server',
  version: '0.1.0'
});

// ===== TOOLS =====

// Tool with read-only annotation
server.registerTool(
  'list_clients',
  {
    title: 'List Clients',
    description: 'Return the list of clients in the in-memory database',
    inputSchema: {},
    outputSchema: {
      count: z.number(),
      clients: z.array(z.object({ id: z.string(), name: z.string() }))
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
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

// Tool with destructive annotation
server.registerTool(
  'add_client',
  {
    title: 'Add Client',
    description: 'Add a client to the in-memory database',
    inputSchema: { name: z.string().min(1) },
    outputSchema: {
      success: z.literal(true),
      client: z.object({ id: z.string(), name: z.string() })
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
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

// Tool that returns isError on failure
server.registerTool(
  'remove_client',
  {
    title: 'Remove Client',
    description: 'Remove a client from the in-memory database by id',
    inputSchema: { id: z.string().min(1) },
    outputSchema: {
      success: z.boolean(),
      removed: z.object({ id: z.string(), name: z.string() }).optional()
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async ({ id }) => {
    const idx = clients.findIndex(c => c.id === id);
    if (idx === -1) {
      const output = { success: false as const, error: 'Client not found' };
      return {
        content: [
          { type: 'text', text: JSON.stringify(output, null, 2) }
        ],
        structuredContent: output,
        isError: true  // This signals a tool-level error
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

// Tool that returns image content
server.registerTool(
  'get_placeholder_image',
  {
    title: 'Get Placeholder Image',
    description: 'Returns a small base64-encoded placeholder image',
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      idempotentHint: true
    }
  },
  async () => {
    // 1x1 red PNG as base64
    const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    return {
      content: [
        { type: 'image', data: tinyPng, mimeType: 'image/png' },
        { type: 'text', text: 'A 1x1 red pixel placeholder image' }
      ]
    };
  }
);

// Tool that simulates long-running with progress (conceptual - actual progress requires session)
server.registerTool(
  'slow_operation',
  {
    title: 'Slow Operation',
    description: 'Simulates a slow operation (2 seconds)',
    inputSchema: { steps: z.number().min(1).max(10).default(5) },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true
    }
  },
  async ({ steps }) => {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const results: string[] = [];
    
    for (let i = 1; i <= steps; i++) {
      await delay(400);
      results.push(`Step ${i}/${steps} completed`);
    }
    
    return {
      content: [
        { type: 'text', text: results.join('\n') }
      ]
    };
  }
);

// ===== RESOURCES =====

// Static resource
server.registerResource(
  'config',
  'resource://config',
  {
    description: 'Server configuration',
    mimeType: 'application/json'
  },
  async () => {
    const resource = resources.get('config')!;
    return {
      contents: [
        { uri: 'resource://config', mimeType: resource.mimeType, text: resource.content }
      ]
    };
  }
);

server.registerResource(
  'readme',
  'resource://readme',
  {
    description: 'Server readme file',
    mimeType: 'text/markdown'
  },
  async () => {
    const resource = resources.get('readme')!;
    return {
      contents: [
        { uri: 'resource://readme', mimeType: resource.mimeType, text: resource.content }
      ]
    };
  }
);

// Note: Dynamic resource templates (resource://client/{id}) would require 
// server.resource() with a URI template pattern. For simplicity, we use static resources.
// To test dynamic resources, add a client first, then use list_clients to get IDs.

// ===== PROMPTS =====

server.registerPrompt(
  'greeting',
  {
    description: 'Generate a greeting message for a user',
    argsSchema: {
      name: z.string().describe('The name to greet')
    }
  },
  async ({ name }) => {
    return {
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: `Please greet ${name} warmly and welcome them to the MCP test server.` }
        }
      ]
    };
  }
);

server.registerPrompt(
  'summarize_clients',
  {
    description: 'Generate a summary of the clients database'
  },
  async () => {
    return {
      messages: [
        {
          role: 'user',
          content: { 
            type: 'text', 
            text: `Please summarize: There are ${clients.length} clients in the database. ${clients.length > 0 ? `Their names are: ${clients.map(c => c.name).join(', ')}` : 'The database is empty.'}` 
          }
        }
      ]
    };
  }
);

// ===== HTTP SERVER =====

const app = express();
app.use(express.json());

// Stateless: create a new transport per request
app.post('/mcp', async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    activeTransports.add(transport);

    res.on('close', () => {
      activeTransports.delete(transport);
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

// ===== ADMIN ENDPOINTS (for testing notifications) =====

// Trigger tools/list_changed notification
app.post('/admin/notify/tools-changed', async (req, res) => {
  console.log('Sending tools/list_changed notification...');
  // In a real scenario, you'd dynamically add/remove tools
  // For testing, this just triggers the notification
  res.json({ success: true, message: 'tools/list_changed notification would be sent (requires active session)' });
});

// Trigger resources/list_changed notification
app.post('/admin/notify/resources-changed', async (req, res) => {
  console.log('Sending resources/list_changed notification...');
  res.json({ success: true, message: 'resources/list_changed notification would be sent' });
});

// Trigger resources/updated notification
app.post('/admin/notify/resource-updated', async (req, res) => {
  const { uri } = req.body;
  console.log(`Sending resources/updated notification for ${uri}...`);
  res.json({ success: true, message: `resources/updated notification for ${uri} would be sent` });
});

// Trigger prompts/list_changed notification
app.post('/admin/notify/prompts-changed', async (req, res) => {
  console.log('Sending prompts/list_changed notification...');
  res.json({ success: true, message: 'prompts/list_changed notification would be sent' });
});

// Send a log message
app.post('/admin/log', async (req, res) => {
  const { level, message, logger } = req.body;
  console.log(`[${level}] ${logger || 'server'}: ${message}`);
  res.json({ success: true, level, message, logger });
});

// Get server status
app.get('/admin/status', (req, res) => {
  res.json({
    clients: clients.length,
    resources: Array.from(resources.keys()),
    prompts: Array.from(prompts.keys()),
    activeTransports: activeTransports.size
  });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`\n🍓 MCP Test Server running at http://localhost:${PORT}`);
  console.log(`\n📡 MCP endpoint: POST http://localhost:${PORT}/mcp`);
  console.log(`\n🔧 Admin endpoints:`);
  console.log(`   GET  /admin/status`);
  console.log(`   POST /admin/notify/tools-changed`);
  console.log(`   POST /admin/notify/resources-changed`);
  console.log(`   POST /admin/notify/resource-updated  { "uri": "..." }`);
  console.log(`   POST /admin/notify/prompts-changed`);
  console.log(`   POST /admin/log  { "level": "info", "message": "...", "logger": "..." }`);
  console.log(`\n✅ Available tools: list_clients, add_client, remove_client, get_placeholder_image, slow_operation`);
  console.log(`📚 Available resources: resource://config, resource://readme, resource://client/{id}`);
  console.log(`💬 Available prompts: greeting, summarize_clients\n`);
});
