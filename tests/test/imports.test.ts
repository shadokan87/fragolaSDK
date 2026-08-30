// Import from the package as if it were installed from npm
// Import all exported values/types from the package index files
// exports from `fragola.index.ts`
import {
	tool,
	stripMeta,
	stripMessagesMeta,
	stripAiMessageMeta,
	stripUserMessageMeta,
	stripToolMessageMeta,
	Fragola,
} from '@fragola-ai/agent';

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
	Tool as ToolType,
	Schema
} from '@fragola-ai/agent';

import type {
	AgentState,
	StepOptions,
	SetOptionsParams,
	CreateAgentOptions,
	ResetParams,
	StepParams,
	UserMessageQuery,
	Agent as AgentType,
} from '@fragola-ai/agent/agent';

// exports from `context.index.ts`
import { Store } from '@fragola-ai/agent/store';
import type { StoreChangeCallback } from '@fragola-ai/agent/store';

// exports from `event.index.ts`
import type {
	AgentDefaultEventId,
	eventResult,
	AgentEventId,
	EventDefaultCallback
} from '@fragola-ai/agent/event';

import { describe, it, expect } from 'vitest';
describe('package import surface', () => {
	it('resolves runtime exports without throwing', () => {
		// runtime exports (types are erased at runtime)
		expect(Fragola).toBeDefined();
		expect(typeof tool === 'function').toBeTruthy();
		expect(typeof Store === 'function').toBeTruthy();
		// expect(typeof AgentContext === 'function').toBeTruthy();
		// skip functions
	});
});