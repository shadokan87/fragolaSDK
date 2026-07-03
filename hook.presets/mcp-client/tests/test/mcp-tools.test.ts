import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mcpClient, type McpClientStoreType } from "@fragola-ai/hook-mcp-client";
import { Fragola } from "@fragola-ai/agent";

describe("hook-mcp-client", () => {

  it("connects and registers tools and resources", async () => {
    const fragola = new Fragola({ apiKey: "test", model: "test" });

    const agent = fragola.agent({
      name: "test",
      description: "",
      instructions: "test"
    }).use(mcpClient({ url: "http://localhost:3000/mcp", name: "test_mcp",
      toolResultProcessor: (result) => {
        if (result.isError) {
          throw new Error("");
        } else {
          if (result.structuredContent)
            return result.structuredContent;
          const content = result.content[0];
          switch (content.type) {
            case "text": {
              const text = content.text.trim();
              if (text[0] == "{" && text.at(-1) == "}")
                return JSON.parse(text);
              return text;
            }
            default: {
              return content;
            }
          }
        }
    }}), "mcpClient");

    await agent.init();

    afterAll(async () => {
      agent.dispose();
    });


    const store = agent.context.getStore<McpClientStoreType>("mcp-client");
    expect(store).toBeDefined();
    if (!store) return;

    const clientData = store.value.data.get("test_mcp");
    expect(clientData).toBeDefined();
    if (!clientData) return;

    expect(clientData.tools.length).toBeGreaterThan(0);
    expect(clientData.ressources.length).toBeGreaterThan(0);
    const listClientsTool = clientData.tools.find((t: any) => t.name === "list_clients");
    expect(listClientsTool).toBeDefined();

    // Call tool
    const result = listClientsTool?.handler != "dynamic" ? await listClientsTool?.handler({}, undefined as any) : undefined;
    expect(typeof result).toBe("object");
    expect(result).toHaveProperty("count");
  });
});
