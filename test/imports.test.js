"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Import from the package as if it were installed from npm
// Import all exported values/types from the package index files
// exports from `fragola.index.ts`
var agentic_sdk_core_1 = require("@fragola-ai/agentic-sdk-core");
// exports from `agent.index.ts`
var agent_1 = require("@fragola-ai/agentic-sdk-core/agent");
// exports from `store.index.ts`
var store_1 = require("@fragola-ai/agentic-sdk-core/store");
// exports from `event.index.ts`
var event_1 = require("@fragola-ai/agentic-sdk-core/event");
var vitest_1 = require("vitest");
console.log("!type: ", typeof agent_1.AgentContext);
(0, vitest_1.describe)('package import surface', function () {
    (0, vitest_1.it)('resolves runtime exports without throwing', function () {
        // runtime exports (types are erased at runtime)
        (0, vitest_1.expect)(agentic_sdk_core_1.Fragola).toBeDefined();
        (0, vitest_1.expect)(typeof agentic_sdk_core_1.tool === 'function').toBeTruthy();
        (0, vitest_1.expect)(typeof store_1.Store === 'function').toBeTruthy();
        (0, vitest_1.expect)(typeof agent_1.AgentContext === 'function').toBeTruthy();
        (0, vitest_1.expect)(typeof agent_1.AgentRawContext === 'function').toBeTruthy();
        (0, vitest_1.expect)(event_1.SKIP_EVENT).toBeDefined();
        // skip functions
        (0, vitest_1.expect)(typeof agent_1.skip === 'function').toBeTruthy();
    });
});
