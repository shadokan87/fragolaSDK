#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type OpenAI from "openai";

type ConversationMessage = OpenAI.Chat.ChatCompletionMessageParam;
type AssistantMessage = Extract<ConversationMessage, { role: "assistant" }>;
type ToolMessage = Extract<ConversationMessage, { role: "tool" }>;
type ToolCallInfo = { index: number; name?: string };
type FormattingState = {
	toolCallsById: Map<string, ToolCallInfo>;
	nextToolCallIndex: number;
	nextFallbackResponseIndex: number;
};

const OUTPUT_SUFFIX = "_MARDOWN_CONVERTED";

const usage = "Usage: bun scripts/jsonToMarkdown-conversation.ts <conversation.json>";

const fail = (message: string): never => {
	console.error(message);
	console.error(usage);
	process.exit(1);
};

const stringifyPretty = (value: unknown) => JSON.stringify(value, null, 2);

const stripTrailingWhitespace = (value: string) => value.replace(/[ \t]+$/gm, "").trim();

const escapeFence = (value: string) => value.replace(/```/g, "``\u0060");

const makeCodeBlock = (value: string, language = "text") => {
	const safe = escapeFence(value);
	return `\`\`\`${language}\n${safe}\n\`\`\``;
};

const normalizeContentPart = (part: unknown): string => {
	if (typeof part === "string")
		return part;

	if (typeof part === "object" && part !== null) {
		const typedPart = part as { type?: unknown; text?: unknown };
		if (typedPart.type === "text" && typeof typedPart.text === "string")
			return typedPart.text;
	}

	return stringifyPretty(part);
};

const normalizeContent = (content: unknown): string => {
	if (content == null)
		return "";

	if (typeof content === "string")
		return content;

	if (Array.isArray(content))
		return content.map(normalizeContentPart).join("\n\n");

	return stringifyPretty(content);
};

const formatToolCalls = (toolCalls: AssistantMessage["tool_calls"]): string => {
	if (!Array.isArray(toolCalls) || toolCalls.length === 0)
		return "";

	return toolCalls.map((toolCall, index) => {
		const typedToolCall = toolCall;
        if (!("function" in typedToolCall))
            return "error";
		const summary = typedToolCall.function?.name
			? `Tool call ${index + 1}: ${typedToolCall.function.name}`
			: `Tool call ${index + 1}`;

		return [
			`<details>`,
			`<summary>${summary}</summary>`,
			"",
			makeCodeBlock(stringifyPretty(typedToolCall), "json").trim(),
			"",
			`</details>`
		].join("\n");
	}).join("\n\n");
};

const parseMaybeJsonString = (value: string): unknown => {
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
};

const formatToolResponse = (
	content: ToolMessage["content"],
	toolDetails?: { toolName?: string; index?: number }
): string => {
	const normalized = normalizeContent(content);
	if (!normalized)
		return "_No tool output_";

	const parsed = parseMaybeJsonString(normalized);
	const payload = typeof parsed === "string" ? parsed : stringifyPretty(parsed);
	const summaryParts = ["Tool Response"];
	if (toolDetails?.index != null)
		summaryParts.push(String(toolDetails.index));
	const summaryPrefix = summaryParts.join(" ");
	const summary = toolDetails?.toolName ? `${summaryPrefix}: ${toolDetails.toolName}` : summaryPrefix;

	return [
		`<details>`,
		`<summary>${summary}</summary>`,
		"",
		makeCodeBlock(payload, typeof parsed === "string" ? "text" : "json").trim(),
		"",
		`</details>`
	].join("\n");
};

const formatAssistantContent = (message: AssistantMessage): string => {
	const sections: string[] = [];
	const content = stripTrailingWhitespace(normalizeContent(message.content));
	if (content)
		sections.push(content);

	const toolCalls = formatToolCalls(message.tool_calls);
	if (toolCalls)
		sections.push(toolCalls);

	return sections.length ? sections.join("\n\n") : "_No assistant content_";
};

const registerToolCalls = (toolCalls: AssistantMessage["tool_calls"], state: FormattingState) => {
	if (!Array.isArray(toolCalls) || toolCalls.length === 0)
		return;

	for (const toolCall of toolCalls) {
		const typedToolCall = toolCall;
		if (!("function" in typedToolCall))
			continue;

		const info: ToolCallInfo = {
			index: state.nextToolCallIndex,
			name: typedToolCall.function?.name
		};

		state.nextToolCallIndex += 1;

		if (typedToolCall.id)
			state.toolCallsById.set(typedToolCall.id, info);
	}
};

const resolveToolResponseInfo = (
	message: ToolMessage & { name?: string; tool_call_id?: string },
	state: FormattingState
): ToolCallInfo => {
	const matchedToolCall = message.tool_call_id
		? state.toolCallsById.get(message.tool_call_id)
		: undefined;

	if (matchedToolCall)
		return matchedToolCall;

	const fallbackInfo: ToolCallInfo = {
		index: state.nextFallbackResponseIndex,
		name: message.name
	};

	state.nextFallbackResponseIndex += 1;
	return fallbackInfo;
};

const formatMessage = (message: ConversationMessage, state: FormattingState): string => {
	const role = message.role ?? "unknown";

	if (role === "user") {
		const content = stripTrailingWhitespace(normalizeContent(message.content)) || "_No user content_";
		return [`## User`, "", content].join("\n");
	}

	if (role === "assistant") {
		registerToolCalls((message as AssistantMessage).tool_calls, state);
		return [`## AI`, "", formatAssistantContent(message as AssistantMessage)].join("\n");
	}

	if (role === "tool") {
		const toolMessage = message as ToolMessage & { name?: string; tool_call_id?: string };
		const toolInfo = resolveToolResponseInfo(toolMessage, state);
		return formatToolResponse(toolMessage.content, { toolName: toolInfo.name, index: toolInfo.index });
	}

	const content = stripTrailingWhitespace(normalizeContent(message.content)) || "_No content_";
	return [`## ${role[0]?.toUpperCase() ?? "U"}${role.slice(1)}`, "", content].join("\n");
};

const extractMessages = (payload: unknown): ConversationMessage[] => {
	if (Array.isArray(payload))
		return payload as ConversationMessage[];

	if (typeof payload === "object" && payload !== null) {
		const typedPayload = payload as {
			messages?: unknown;
			state?: { messages?: unknown };
		};

		if (Array.isArray(typedPayload.messages))
			return typedPayload.messages as ConversationMessage[];

		if (Array.isArray(typedPayload.state?.messages))
			return typedPayload.state.messages as ConversationMessage[];
	}

	return fail("Unsupported conversation format. Expected a message array, an object with `messages`, or an object with `state.messages`.");
};

const inputArg = process.argv[2];

if (!inputArg)
	fail("Missing conversation JSON path.");

const inputPath = path.resolve(process.cwd(), inputArg);
if (!fs.existsSync(inputPath))
	fail(`File not found: ${inputPath}`);

const parsedPath = path.parse(inputPath);
const outputPath = path.join(parsedPath.dir, `${parsedPath.name}${OUTPUT_SUFFIX}.md`);

let payload: unknown;
try {
	payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
} catch (error) {
	fail(`Failed to parse JSON file '${inputPath}': ${error instanceof Error ? error.message : String(error)}`);
}

const messages = extractMessages(payload);
const formattingState: FormattingState = {
	toolCallsById: new Map(),
	nextToolCallIndex: 1,
	nextFallbackResponseIndex: 1
};
const markdown = [
	`# Conversation`,
	"",
	`Source: ${path.basename(inputPath)}`,
	"",
	...messages.map((message) => formatMessage(message, formattingState))
].join("\n\n");

fs.writeFileSync(outputPath, `${markdown.trim()}\n`, "utf8");
console.log(`Markdown conversation written to ${outputPath}`);
