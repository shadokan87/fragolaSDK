// Example usage (skeleton):
// agent.use(orchestration((lead) => ({
//     participants: [lead, searchWeb, summaryAgent, computerUse],
//     // Use a Map keyed by Agent instances for flow
//     flow: new Map([
//         [lead, "*"],
//         [searchWeb, { agent: computerUse }],
//         [searchWeb, { agent: summaryAgent, bidirectional: lead.state.conversation.length ? true : false }],
//         [summaryAgent, { agent: lead }],
//     ])
// })));
import { type AgentAny } from "@src/agent";
import type { FragolaHook } from "..";
import type { UserMessageQuery } from "dist/agent.index";
import type { maybePromise } from "@src/types";

export namespace OrchestrationType {
    export type participants = AgentAny[];
    export type flowValue = "*" | {
        to: participants[0],
        bidirectional?: boolean
    }
    // Flow keyed by Agent instance; Record<> cannot use objects as keys
    export type flowMap = Map<AgentAny, flowValue>;
    export type flow = flowMap | [AgentAny, flowValue][];
    export type config = {
        participants: participants,
        flow: flow,
        onMessage?: (source: AgentAny, dest: AgentAny, message: UserMessageQuery, reject: (reason: string) => string) => maybePromise<string | UserMessageQuery>
    }
}

type OrchestrationBuilder = (lead: AgentAny, flow: OrchestrationType.flowMap) => OrchestrationType.config;
// High-order hook: accepts a builder, returns a FragolaHook.
// Callback order at runtime:
// 1) You call orchestration(builder)
// 2) agent.use(hook) invokes the returned function with the "lead" agent
// 3) We call builder(lead) to get { participants, flow }
// 4) Optionally register events across participants using the flow (TODOs below)
export const orchestration = (build: OrchestrationBuilder): FragolaHook => {
    return (lead) => {
        // 3) Build the orchestration config from the lead agent
        const { participants, flow: flowReturn } = build(lead as AgentAny, new Map());
        const flow: OrchestrationType.flowMap = flowReturn instanceof Map ? flowReturn : new Map(flowReturn);

        // Basic sanity checks (dev-time guardrails; no heavy logic here)
        // These are optional and can be removed if undesired
        if (!Array.isArray(participants)) {
            console.warn("orchestration: 'participants' should be an array of Agent instances");
        }
        if (!(flow instanceof Map)) {
            console.warn("orchestration: 'flow' should be a Map<Agent, flowValue>");
        }

        // 4) SKELETON ONLY — no behavior yet.
        // TODO: Example wiring outline (not implemented):
        // - For each [source, rule] in flow:
        //   - If rule === "*": set up broadcast from source to all others
        //   - Else: set up directed relay between source -> rule.agent
        //   - If rule.bidirectional: also set up rule.agent -> source
        // - Use participants[i].onUserMessage / onAiMessage / onAfterConversationUpdate as needed

        void participants;
        void flow;
    };
}
// Participants are a list of agents (lead is typically included as the first item)
