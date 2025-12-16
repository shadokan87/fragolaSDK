import type { FragolaHook } from "..";
import type { AgentAny } from "@src/agent";
import { skip } from "../../event";
import type { Span, Tracer, TraceAPI, Attributes, Exception } from "@opentelemetry/api";

export type TelemetryNodeOptions = {
	/** Optional logical service name to attach to spans. */
	serviceName?: string;
	/** Name for the tracer; defaults to "fragola-agent". */
	tracerName?: string;
	/** Optional tracer version. */
	tracerVersion?: string;
};

export type TelemetrySdk = { trace: TraceAPI };

const resolveTracer = (sdk: TelemetrySdk, opts: TelemetryNodeOptions): Tracer => {
	return sdk.trace.getTracer(opts.tracerName ?? "fragola-agent", opts.tracerVersion);
};

/**
 * Node.js telemetry hook that wires a provided OpenTelemetry SDK (or tracer)
 * to the Fragola agent lifecycle using events.
 *
 * The hook focuses on:
 * - Tracking agent run lifecycle via `onAfterStateUpdate`.
 * - Emitting message-level events via `onAfterMessagesUpdate`.
 * - Wrapping model invocations in dedicated spans via `onModelInvocation`.
 *
 * You are expected to pass an object compatible with the OpenTelemetry
 * `TraceAPI` surface, e.g. the result of:
 *
 * ```ts
 * import * as otel from "@opentelemetry/api";
 * agent.use(telemetry(otel, { serviceName: "my-service" }));
 * ```
 */
export const telemetry = (sdk: TelemetrySdk, options: TelemetryNodeOptions = {}): FragolaHook => {
	const tracer = resolveTracer(sdk, options);

	return (agent: AgentAny) => {
		const baseAttributes: Attributes = {
			"fragola.agent.id": agent.id,
			"fragola.agent.name": agent.options.name,
			"fragola.agent.description": agent.options.description ?? "",
			"fragola.agent.model": agent.options.modelSettings?.model ?? "",
		};

		if (options.serviceName) {
			baseAttributes["service.name"] = options.serviceName;
		}

		let runSpan: Span | undefined;
		let currentModelSpan: Span | undefined;
		// TODO ⚠️: when a dedicated `after:modelInvocation` event exists,
		// use it instead of inferring completion from `after:messagesUpdate`.

		const startRunSpan = () => {
			if (runSpan) return;
			runSpan = tracer.startSpan("fragola.agent.run", { attributes: { ...baseAttributes } });
			runSpan.addEvent?.("agent.run.start", {
				"fragola.state.status": agent.state.status,
				"fragola.state.stepCount": agent.state.stepCount,
			});
		};

		const endRunSpan = (reason: string) => {
			if (!runSpan) return;
			runSpan.addEvent?.("agent.run.end", {
				reason,
				"fragola.state.status": agent.state.status,
				"fragola.state.stepCount": agent.state.stepCount,
			});
			runSpan.end();
			runSpan = undefined;
		};

		// Track lifecycle via state transitions.
		// Use priority "start" so other state side-effects can still run
		// and we observe the final state snapshot for this transition.
		agent.onAfterStateUpdate((context) => {
			const { status, stepCount } = context.state;

			// Start a run span on first transition into "generating".
			if (status === "generating") {
				startRunSpan();
			}

			// Add an event for every state change while the run span is active.
			runSpan?.addEvent?.("agent.stateUpdate", {
				"fragola.state.status": status,
				"fragola.state.stepCount": stepCount,
			});

			// When going back to idle, consider the run finished.
			if (status === "idle") {
				endRunSpan("idle");
			}
		}, { priority: "end" });

		// Track message mutations and reasons (user, tool, ai, etc...).
		// Use priority "end" so we see the final messages/state after all
		// other handlers have run, which gives a chronological view.
		agent.onAfterMessagesUpdate((reason, context) => {
			const { messages, stepCount, status } = context.state;
			const attrs: Attributes = {
				reason,
				"fragola.messages.count": messages.length,
				"fragola.state.stepCount": stepCount,
				"fragola.state.status": status,
			};

			// Emit generic messages update event.
			runSpan?.addEvent?.("agent.messagesUpdate", attrs);

			// Derive more structured timeline from the reason and last message.
			const lastMessage = messages[messages.length - 1];
			if (!lastMessage) return;

			if (reason === "userMessage" && lastMessage.role === "user") {
				runSpan?.addEvent?.("agent.message.user", {
					"fragola.message.role": "user",
					"fragola.message.index": messages.length - 1,
				});
			}

			if (reason === "toolCall" && lastMessage.role === "tool") {
				// TODO ⚠️: a dedicated `after:toolCall` event would let us
				// create proper spans per tool execution instead of inferring
				// from the appended tool message.
				runSpan?.addEvent?.("agent.message.tool", {
					"fragola.message.role": "tool",
					"fragola.message.index": messages.length - 1,
					"fragola.tool_call.id": (lastMessage as any).tool_call_id ?? "",
				});
			}

			if (reason === "partialAiMessage" && lastMessage.role === "assistant") {
				runSpan?.addEvent?.("agent.message.ai.partial", {
					"fragola.message.role": "assistant",
					"fragola.message.index": messages.length - 1,
				});
			}

			if (reason === "AiMessage" && lastMessage.role === "assistant") {
				// Final assistant message for this model invocation.
				runSpan?.addEvent?.("agent.message.ai", {
					"fragola.message.role": "assistant",
					"fragola.message.index": messages.length - 1,
				});

				// Close any open model span now that we have a response.
				currentModelSpan?.addEvent?.("agent.modelInvocation.result", {
					"fragola.state.stepCount": stepCount,
					"fragola.state.status": status,
				});
				currentModelSpan?.end();
				currentModelSpan = undefined;
			}
		}, { priority: "end" });

		// Observe model invocations without taking ownership of the API call.
		// We return `skip()` so that the default behavior (and other handlers)
		// still control when `callAPI` is actually executed.
		agent.onModelInvocation(async (_callAPI, context) => {
			// If a model span is already open, close it before starting a new one.
			if (currentModelSpan) {
				currentModelSpan.addEvent?.("agent.modelInvocation.overlap", {
					"fragola.state.stepCount": context.state.stepCount,
					"fragola.state.status": context.state.status,
				});
				currentModelSpan.end();
			}

			currentModelSpan = tracer.startSpan("fragola.agent.modelInvocation", {
				attributes: {
					...baseAttributes,
					"fragola.state.stepCount": context.state.stepCount,
					"fragola.state.status": context.state.status,
				},
			});
			currentModelSpan.addEvent?.("agent.modelInvocation.start", {
				"fragola.state.stepCount": context.state.stepCount,
				"fragola.state.status": context.state.status,
			});

			// Observer-only: do not call `_callAPI` from telemetry.
			return skip();
		}, { priority: "start" });
	};
};

export default telemetry;

