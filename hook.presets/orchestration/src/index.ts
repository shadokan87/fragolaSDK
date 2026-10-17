import { messagesUtils, tool } from "@fragola-ai/agent";
import type { Agent, UserMessageQuery } from "@fragola-ai/agent/agent";
import type { FragolaHook } from "@fragola-ai/agent/hook";
import z from "zod";

type MaybePromise<T> = Promise<T> | T;

export namespace OrchestrationType {
  export type participants = Agent[];
  export type flowValue = {
    to: participants[0] | "*";
    bidirectional?: boolean;
    replyLength?: number;
  };
  export type flow = [Agent, flowValue][];
  export type config = {
    participants: participants;
    flow: flow;
    onMessage?: (source: Agent, dest: Agent, message: UserMessageQuery, reject: (reason: string) => string) => MaybePromise<string | UserMessageQuery>;
  };
}

export type OrchestrationBuilder = (lead: Agent) => OrchestrationType.config;

export class OrchestrationBadConfig extends Error {
  constructor(message: string, cause: string) {
    super(message);
    this.cause = cause;
    this.name = "OrchestrationBadConfig";
    if (Error.captureStackTrace)
      Error.captureStackTrace(this, OrchestrationBadConfig);
  }
}

function renderToolDescription(name: string, description: string) {
  return `
<tool name="${name}">
    <description>
        ${description}
    </description>
</tool>`;
}

function renderAgentDescription(agent: Agent) {
  const tools = (agent.options.tools ?? [])
    .map((configuredTool) => renderToolDescription(configuredTool.name, configuredTool.description))
    .join("");

  return `
<agent name="${agent.options.name}" id="${agent.id}">
    <description>
    ${agent.options.description}
    </description>
<tools>${tools}
</tools>
</agent>`;
}

function renderOrchestrationPrompt(agentDescriptions: string) {
  return `
<orchestration>
<instructions>You are part of a multi-agent orchestration.
You can send messages to other agents using the 'message_agent' tool.
Here are the other agents you can communicate with.</instructions>
<agents_list>${agentDescriptions}
</agents_list>
</orchestration>`;
}

export const orchestration = (build: OrchestrationBuilder): FragolaHook => {
  return (lead: Parameters<FragolaHook>[0]) => {
    const { participants, flow, onMessage } = build(lead as Agent);

    if (!Array.isArray(participants))
      console.warn("orchestration: 'participants' should be an array of Agent instances");

    if (new Set(participants.map((participant) => participant.id)).size !== participants.length) {
      throw new OrchestrationBadConfig("Participants cannot have duplicates", "participants_duplicate");
    }

    {
      let participantsIds = participants.map((participant) => participant.id);

      findUnusedParticipants: {
        for (const [source, destination] of flow) {
          if (destination.to === "*") {
            participantsIds = [];
            break findUnusedParticipants;
          }

          const directDestination = destination.to;

          if (participantsIds.includes(source.id))
            participantsIds = participantsIds.filter((id) => id !== source.id);

          if (participantsIds.includes(directDestination.id))
            participantsIds = participantsIds.filter((id) => id !== directDestination.id);
        }
      }

      if (participantsIds.length !== 0) {
        throw new OrchestrationBadConfig(
          `All participants must be used in the flow, directly or by using a wildcard. Unused participants: ${JSON.stringify(participants.filter((participant) => participantsIds.includes(participant.id)).map((participant) => ({ name: participant.options.name + (participant.id === lead.id ? " (lead)" : ""), id: participant.id })), null, 2)}`,
          "declared_but_unused_participants",
        );
      }
    }

    const communicationMap: Map<Agent, OrchestrationType.flowValue[]> = new Map();

    for (const [source, destination] of flow) {
      const existingTargets = communicationMap.get(source) ?? [];
      let normalizedTargets: OrchestrationType.flowValue[] = [];

      if (destination.to === "*") {
        normalizedTargets = participants
          .filter((participant) => participant.id !== source.id)
          .map((participant) => ({ to: participant }));

        if (destination.bidirectional) {
          for (const participant of participants) {
            if (participant.id === source.id)
              continue;
            const targets = communicationMap.get(participant) ?? [];
            targets.push({ to: source });
            communicationMap.set(participant, targets);
          }
        }
      } else {
        normalizedTargets = [destination];
        if (destination.bidirectional) {
          const targets = communicationMap.get(destination.to) ?? [];
          targets.push({ to: source });
          communicationMap.set(destination.to, targets);
        }
      }

      communicationMap.set(source, [...existingTargets, ...normalizedTargets]);
    }

    const messageAgentSchema = z.object({
      id: z.string().describe("The id of the agent"),
      message: z.string().describe("The message to send"),
    });

    for (const [source, destinations] of communicationMap) {
      const messageAgentTool = tool({
        name: "message_agent",
        description: "send a message to another agent",
        schema: messageAgentSchema,
        handler: async (params) => {
          const destination = destinations.find((entry) => entry.to !== "*" && entry.to.id === params.id)?.to as Agent | undefined;
          if (!destination)
            return `Agent with id ${params.id} does not exist`;

          const nextMessage = onMessage
            ? await onMessage(source, destination, { content: params.message }, (reason) => reason)
            : { content: params.message };

          if (typeof nextMessage === "string")
            return `Your message request have been rejected for the following reason: ${nextMessage}`;

          const destinationState = await destination.userMessage(nextMessage);
          const finalOutput = messagesUtils(destinationState.messages).finalOutput();
          return finalOutput ?? `Message delivered to agent with id ${params.id}. But the agent failed to produce an output (undefined) output`;
        },
      });

      const nextInstructions = `${source.options.instructions}\n${renderOrchestrationPrompt(destinations.map((entry) => renderAgentDescription(entry.to as Agent)).join(""))}`;

      source.setOptions({
        ...source.options,
        tools: [...(source.options.tools ?? []), messageAgentTool],
        instructions: nextInstructions,
      });
    }
  };
};

export default orchestration;