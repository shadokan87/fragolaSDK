# @fragola-ai/hook-mcp-client

Load MCP tools into a Fragola agent as standard agent tools.

## Install

```bash
npm install @fragola-ai/agent @fragola-ai/hook-mcp-client
```

## Usage

```ts
import { mcpClient } from "@fragola-ai/hook-mcp-client";

agent.use(mcpClient({
  name: "docs-mcp",
  url: "http://localhost:3000/mcp"
}), "mcp-client");
```