// Import from the package as if it were installed from npm
// Import all exported values/types from the package index files
// exports from `fragola.index.ts`
import {
	tool,
	stripMeta,
	stripConversationMeta,
	stripAiMessageMeta,
	stripUserMessageMeta,
	stripToolMessageMeta,
	Fragola
} from '@fragola-ai/agentic-sdk-core';

import type {
	ToolHandlerReturnTypeNonAsync,
	ToolHandlerReturnType,
	AllowedMetaKeys,
	DefineMetaData,
	ChatCompletionUserMessageParam,
	ChatCompletionAssistantMessageParam,
	ChatCompletionToolMessageParam,
	MessageMeta,
	ChatCompletionMessageParam,
	Tool as ToolType
} from '@fragola-ai/agentic-sdk-core';

// exports from `agent.index.ts`
import {
	AgentContext,
    //@ts-ignore
	skip as skipFromAgent
} from '@fragola-ai/agentic-sdk-core/agent';

import type {
	AgentState,
	StepOptions,
	SetOptionsParams,
	CreateAgentOptions,
	ResetParams,
	StepParams,
	UserMessageQuery,
	Agent as AgentType,
} from '@fragola-ai/agentic-sdk-core/agent';

// exports from `store.index.ts`
import { Store } from '@fragola-ai/agentic-sdk-core/store';
import type { StoreChangeCallback } from '@fragola-ai/agentic-sdk-core/store';

// exports from `event.index.ts`
import { SKIP_EVENT, skip as skipFromEvent } from '@fragola-ai/agentic-sdk-core/event';
import type {
	AgentDefaultEventId,
	AgentAfterEventId,
	eventResult,
	AgentEventId,
	EventDefaultCallback
} from '@fragola-ai/agentic-sdk-core/event';

import { describe, it, expect } from 'vitest';
describe('package import surface', () => {
	it('resolves runtime exports without throwing', () => {
		// runtime exports (types are erased at runtime)
		expect(Fragola).toBeDefined();
		expect(typeof tool === 'function').toBeTruthy();
		expect(typeof Store === 'function').toBeTruthy();
		expect(typeof AgentContext === 'function').toBeTruthy();
		expect(SKIP_EVENT).toBeDefined();
		// skip functions
		expect(typeof skipFromAgent === 'function').toBeTruthy();
	});
});