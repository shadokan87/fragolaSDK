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
import { FragolaError } from "@src/exceptions";
import { Prompt } from "@fragola-ai/prompt";

export namespace OrchestrationType {
    export type participants = AgentAny[];
    export type flowValue = {
        to: participants[0] | "*",
        bidirectional?: boolean
    }
    // Flow keyed by Agent instance; Record<> cannot use objects as keys
    export type flow = [AgentAny, flowValue][];
    export type config = {
        participants: participants,
        flow: flow,
        onMessage?: (source: AgentAny, dest: AgentAny, message: UserMessageQuery, reject: (reason: string) => string) => maybePromise<string | UserMessageQuery>
    }
}

type OrchestrationBuilder = (lead: AgentAny) => OrchestrationType.config;

export class OrchestrationBadConfig extends FragolaError {
    constructor(message: string, cause: string) {
        super(message);
        this.cause = cause;
        this.name = "OrchestrationBadConfig";
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, OrchestrationBadConfig)
        }
    }
}
// High-order hook: accepts a builder, returns a FragolaHook.
// Callback order at runtime:
// 1) You call orchestration(builder)
// 2) agent.use(hook) invokes the returned function with the "lead" agent
// 3) We call builder(lead) to get { participants, flow }
// 4) Optionally register events across participants using the flow (TODOs below)
export const orchestration = (build: OrchestrationBuilder): FragolaHook => {
    return (lead) => {
        // 3) Build the orchestration config from the lead agent
        const { participants, flow } = build(lead as AgentAny);

        // Basic sanity checks (dev-time guardrails; no heavy logic here)
        // These are optional and can be removed if undesired
        if (!Array.isArray(participants)) {
            console.warn("orchestration: 'participants' should be an array of Agent instances");
        }
        // participants duplicate
        {
            if (new Set(participants.map(p => p.id)).size != participants.length) {
                throw new OrchestrationBadConfig(`Participants cannot have duplicates`, "participants_duplicate");
            }
        }
        findUnusedParticipants: {
            let participantsIds = participants.map(p => p.id);
            for (const [k, v] of flow) {
                if (v.to == "*") {
                    participantsIds = [];
                    break findUnusedParticipants;
                }
                if (participantsIds.includes(k.id)) {
                    participantsIds = participantsIds.filter(p => p != k.id);
                }
                if (participantsIds.includes(v.to.id)) {
                    //@ts-ignore
                    participantsIds = participantsIds.filter(p => p != v.to.id);
                }
            }
            if (participantsIds.length != 0) {
                throw new OrchestrationBadConfig(`All participants must be used in the flow, directly or by using a wildcard. Unused participants: ${JSON.stringify(participants.filter(p => participantsIds.includes(p.id)).map(p => (({ name: p.options.name + (p.id == lead.id ? ' (lead)' : ''), id: p.id }))), null, 2)}`, "declared_but_unused_participants");
            }
        }
        // system prompt injection
        {
            const communicationMap: Map<AgentAny, OrchestrationType.flowValue[]> = new Map();
            // k = agent source, v = flowValue (agent dest or wildcard with options)
            for (const [k, v] of flow) {
                let arr = communicationMap.get(k) || [];
                //  we use an array to store flowValue because it is possible v.to is a wildcard
                let _v: OrchestrationType.flowValue[] = [];

                // if the flow value's 'to' is a wildcard, we retrieve the other agents to set them as destination in _v array
                if (v.to === "*") {
                    // lead -> all others
                    _v = participants.filter(p => p.id != k.id).map(p => ({ to: p }));
                    // all others -> lead (bidirectional)
                    if (v.bidirectional) {
                        for (const p of participants) {
                            if (p.id !== k.id) {
                                const arr2 = communicationMap.get(p) || [];
                                arr2.push({ to: k }); // p -> lead
                                communicationMap.set(p, arr2);
                            }
                        }
                    }
                } else {
                    _v = [v];
                    if (v.bidirectional) {
                        const arr2 = communicationMap.get(v.to) || [];
                        arr2.push({ to: k });
                        communicationMap.set(v.to, arr2)
                    }
                }
                arr = [...arr, ..._v];
                communicationMap.set(k, arr);
            }
            const systemPromptTemplate = `
<orchestration>
You are part of a multi-agent orchestration.
You can send messages to other agents using the 'message_agent' tool.
Here are the other agents you can communicate with.
<agents_description>
{{agents_descriptions}}
</agents_description>
</orchestration>`;
            const agentToolTemplate = `
<tool name="{{name}}">
    <description>
        {{description}}
    </description>
</tool>
                    `;
            const agentDescriptionTemplate = `
<agent name="{{name}}">
    <description>
    {{description}}
    </description>
<tools>
{{tools}}
</tools>
</agent>
`;
            type systemPromptVariables = Record<"agents_descriptions", string>;
            type agentToolVariables = Record<"name" | "description", string>;
            type agentDescriptionVariables = Record<"name" | "description" | "tools", string>;

            for (const [k, v] of communicationMap) {
                const agentsDescription: Prompt[] = [];

                for (const dest of v as { to: AgentAny }[]) {
                    const agentDescription = new Prompt(agentDescriptionTemplate, {
                        name: dest.to.options.name,
                        description: dest.to.options.description,
                        tools: dest.to.options.tools ? dest.to.options.tools.map(tool => (new Prompt(agentToolTemplate, {
                            name: tool.name,
                            description: tool.description
                        } as agentToolVariables).value)).join("\n") : ""
                    } as agentDescriptionVariables);
                    agentsDescription.push(agentDescription)
                }

                const systemPrompt: Prompt = new Prompt(systemPromptTemplate, {
                    agents_descriptions: agentsDescription.map(prompt => prompt.value).join("\n")
                } as systemPromptVariables);
                k.setOptions({...k.options, instructions: k.options.instructions + `\n${systemPrompt.value}`});
            }
            // // Convert communicationMap to array and log it
            // const commArray = Array.from(communicationMap.entries()).map(([agent, flows]) => ({
            //     agent: (agent.options?.name || agent.id) + (agent.id == lead.id ? " (lead)" : ""),
            //     flows: flows.map(f => ({
            //         to: typeof f.to === 'string' ? f.to : (f.to.options?.name || f.to.id) + (f.to.id == lead.id ? " (lead)" : ""),
            //         bidirectional: f.bidirectional
            //     }))
            // }));
            // console.log(JSON.stringify(commArray, null, 2));

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
