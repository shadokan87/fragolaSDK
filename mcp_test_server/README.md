# Test MCP Server (Bun + TypeScript)

Remote MCP server (no stdio) using the official TypeScript SDK and Bun runtime.

It exposes three tools backed by an in-memory array:

- list_clients: list all clients
- add_client: add a client by name
- remove_client: remove a client by id

## Requirements

- Bun 1.1+ (https://bun.sh)

## Install

```sh
bun install
```

## Run

- Dev (auto-reload):

```sh
bun run dev
```

- Start:

```sh
bun start
```

Server will listen on http://localhost:3000/mcp.

You can change the port with `PORT=4000`.

## How it works

- Remote transport: Streamable HTTP (recommended). No stdio.
- Endpoint: POST /mcp (stateless; a new transport is created per request).
- SDK: `@modelcontextprotocol/sdk` with `McpServer`.

## Tool contracts

- list_clients
  - input: none
  - output: { count: number, clients: { id: string, name: string }[] }

- add_client
  - input: { name: string }
  - output: { success: true, client: { id: string, name: string } }

- remove_client
  - input: { id: string }
  - output: { success: boolean, removed?: { id: string, name: string } }

## Connect from an MCP client

- VS Code (Copilot):

  ```sh
  code --add-mcp '{"name":"test-mcp-server","type":"http","url":"http://localhost:3000/mcp"}'
  ```

- Claude Code:

  ```sh
  claude mcp add --transport http test-mcp-server http://localhost:3000/mcp
  ```

- MCP Inspector:

  ```sh
  npx @modelcontextprotocol/inspector
  # Then connect to http://localhost:3000/mcp
  ```

## Notes

- This server uses an in-memory array; restarting clears data.
- For browser-based clients, you may need to enable CORS if you expose it cross-origin.
