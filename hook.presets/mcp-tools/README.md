# @fragola-ai/hook-mcp-tools

Load MCP tools into a Fragola agent as standard agent tools.

## Install

```bash
npm install @fragola-ai/agent @fragola-ai/hook-mcp-tools
```

## Usage

```ts
import { mcpTools } from "@fragola-ai/hook-mcp-tools";

agent.use(mcpTools({
  client: {
    name: "docs-mcp",
    url: "http://localhost:3000/mcp"
  }
}), "mcp-tools");
```