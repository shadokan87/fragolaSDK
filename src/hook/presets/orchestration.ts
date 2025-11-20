import { type AgentAny } from "@src/agent";
import type { FragolaHook } from "..";
import type { UserMessageQuery } from "@src/agent";
import type { maybePromise } from "@src/types";
import { FragolaError } from "@src/exceptions";
import { Prompt } from "@fragola-ai/prompt";
import z from "zod";
import { tool } from "@src/fragola";
import { messagesUtils } from "@src/stateUtils";

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

export type OrchestrationBuilder = (lead: AgentAny) => OrchestrationType.config;

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

export const orchestration = (build: OrchestrationBuilder): FragolaHook => {
    return (lead) => {
        // 3) Build the orchestration config from the lead agent
        const { participants, flow, onMessage } = build(lead as AgentAny);

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
<instructions>You are part of a multi-agent orchestration.
You can send messages to other agents using the 'message_agent' tool.
Here are the other agents you can communicate with.</instructions>
<agents_list>{{agents_list}}
</agents_list>
</orchestration>`;
            const agentToolTemplate = `
<tool name="{{name}}">
    <description>
        {{description}}
    </description>
</tool>`;
            const agentDescriptionTemplate = `
<agent name="{{name}}" id="{{id}}">
    <description>
    {{description}}
    </description>
<tools>{{tools}}
</tools>
</agent>`;
            type systemPromptVariables = Record<"agents_list", string>;
            type agentToolVariables = Record<"name" | "description", string>;
            type agentDescriptionVariables = Record<"name" | "description" | "tools" | "id", string>;
            const messageAgentSchema = z.object({
                id: z.string().describe("The id of the agent"),
                message: z.string().describe("The message to send")
            });

            for (const [k, v] of communicationMap) {
                const agentsDescription: Prompt[] = [];
                k.setOptions({
                    ...k.options,
                    tools: [...k.options.tools || [], tool({
                        name: "message_agent",
                        description: "send a message to another agent",
                        schema: messageAgentSchema,
                        handler: async (params) => {
                            const dest: AgentAny | undefined = v.find(agent => (agent.to as AgentAny).id == params.id)?.to as AgentAny;
                            if (!dest)
                                return `Agent with id ${params.id} does not exist`;
                            const userMessage = onMessage ? await onMessage(k, dest, {
                                content: params.message
                            }, (reason) => reason) : {
                                content: params.message
                            };

                            if (typeof userMessage == "string")
                                return `Your message request have been rejected for the following reason: ${userMessage}`;
                            const destState = await dest.userMessage(userMessage);
                            const finalOutput = messagesUtils(destState.messages).finalOutput();
                            return finalOutput ?? `Message delivered to agent with id ${params.id}. But the agent failed to produce an output (undefined) output`
                        }
                    })]
                })

                for (const dest of v as { to: AgentAny }[]) {
                    const agentDescription = new Prompt(agentDescriptionTemplate, {
                        name: dest.to.options.name,
                        description: dest.to.options.description,
                        id: dest.to.id,
                        tools: dest.to.options.tools ? dest.to.options.tools.map(tool => (new Prompt(agentToolTemplate, {
                            name: tool.name,
                            description: tool.description
                        } as agentToolVariables).value)).join("") : ""
                    } as agentDescriptionVariables);
                    agentsDescription.push(agentDescription)
                }

                const systemPrompt: Prompt = new Prompt(systemPromptTemplate, {
                    agents_list: agentsDescription.map(prompt => prompt.value).join("")
                } as systemPromptVariables);
                k.setOptions({ ...k.options, instructions: k.options.instructions + `\n${systemPrompt.value}` });
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
    };
}
// Participants are a list of agents (lead is typically included as the first item)