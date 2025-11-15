/**
 * Test file to verify string schema support in tools
 */

import { Fragola, tool } from "@fragola-ai/agentic-sdk-core";
import { z } from "zod";

// Test 1: Tool with Zod schema (existing functionality)
const toolWithZod = tool({
    name: "get_weather_zod",
    description: "Get weather with Zod validation",
    schema: z.object({
        location: z.string(),
        unit: z.enum(["celsius", "fahrenheit"]).optional()
    }),
    handler: (params) => {
        console.log("Zod validated params:", params);
        return `Weather in ${params.location} is sunny`;
    }
});

// Test 2: Tool with string schema (new functionality)
const toolWithStringSchema = tool({
    name: "get_weather_string",
    description: "Get weather with string schema (no validation)",
    schema: JSON.stringify({
        type: "object",
        properties: {
            location: { type: "string" },
            unit: { type: "string", enum: ["celsius", "fahrenheit"] }
        },
        required: ["location"]
    }),
    handler: (params: any) => {
        // Manual validation if needed
        console.log("String schema params (no auto-validation):", params);
        if (!params.location) {
            return "Error: location is required";
        }
        return `Weather in ${params.location} is cloudy`;
    }
});

// Test 3: Tool without schema
const toolNoSchema = tool({
    name: "get_time",
    description: "Get current time",
    handler: () => {
        return new Date().toISOString();
    }
});

console.log("✓ Tool with Zod schema created");
console.log("✓ Tool with string schema created");
console.log("✓ Tool without schema created");
console.log("\nAll tools configured successfully!");
