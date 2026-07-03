import { describe, expect, it } from "vitest";
import { tool, type Schema } from "@fragola-ai/agent";
import * as z3 from "zod/v3";
import * as z4 from "zod/v4";
import {zodToJsonSchema as _zodToJsonSchema} from "zod-to-json-schema";

const isZodV4Schema = (schema: Exclude<Schema, string>): schema is z4.ZodType => "_zod" in schema;

const zodToJsonSchema = <TSCHEMA extends Schema>(schema: TSCHEMA) => {
    if (typeof schema === "string") {
        throw new Error("Cannot convert a string schema to JSON schema. Pass a Zod schema instead.");
    }

    if (isZodV4Schema(schema))
        return z4.toJSONSchema(schema);

    return _zodToJsonSchema(schema as z3.ZodType);
}

describe("zodToJsonSchema", () => {
    it("converts tool schemas from zod v3 and v4", () => {
        const v3Tool = tool({
            name: "v3_tool",
            description: "v3 schema tool",
            schema: z3.object({ location: z3.string() }),
            handler: ({ location }: { location: string }) => location,
        });

        const v4Tool = tool({
            name: "v4_tool",
            description: "v4 schema tool",
            schema: z4.object({ city: z4.string() }),
            handler: ({ city }: { city: string }) => city,
        });

        const v3Schema = zodToJsonSchema(v3Tool.schema!);
        const v4Schema = zodToJsonSchema(v4Tool.schema!);

        expect(v3Schema).toMatchObject({
            type: "object",
            properties: {
                location: { type: "string" },
            },
            required: ["location"],
        });

        expect(v4Schema).toMatchObject({
            type: "object",
            properties: {
                city: { type: "string" },
            },
            required: ["city"],
        });
    });
});