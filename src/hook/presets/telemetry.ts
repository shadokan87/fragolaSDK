import type { FragolaHook } from "..";
import type { AgentAny } from "@src/agent";
import { skip } from "../../event";
import type { Span, Tracer, TraceAPI, Attributes, Exception, AttributeValue } from "@opentelemetry/api";

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
 * Helper to ensure values are compatible with OpenTelemetry AttributeValue.
 * If not compatible, returns the type of the value as a string.
 */
const toAttributeValue = (v: any): AttributeValue => {
	if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
		return v;
	}
	if (Array.isArray(v)) {
		// OpenTelemetry requires homogeneous arrays of primitives.
		const first = v.find((x) => x !== null && x !== undefined);
		if (first === undefined) return v as any[];
		const type = typeof first;
		if (type === "string" || type === "number" || type === "boolean") {
			if (v.every((x) => x === null || x === undefined || typeof x === type)) {
				return v as any[];
			}
		}
	}
	return typeof v;
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
			"fragola.agent.instructions": agent.options.instructions,
			"fragola.agent.model": agent.options.modelSettings?.model ?? "",
		};
		if (agent.context.options.modelSettings) {
			type ModelSettings = typeof agent.context.options.modelSettings;
			for (const k of Object.keys(agent.context.options.modelSettings) as Array<keyof ModelSettings>) {
				const v = agent.context.options.modelSettings[k];
				const key = `fragola.agent.modelSettings.${String(k)}`;
				baseAttributes[key] = toAttributeValue(v);
			}
		}
		if (options.serviceName) {
			baseAttributes["service.name"] = options.serviceName;
		}

		let runSpan: Span | undefined;
		let currentModelSpan: Span | undefined;

		// const startRunSpan = () => {
		// 	if (runSpan) return;
		// 	runSpan = tracer.startSpan("fragola.agent.run", { attributes: { ...baseAttributes } });
		// 	runSpan.addEvent?.("agent.run.start", {
		// 		"fragola.state.status": agent.state.status,
		// 		"fragola.state.stepCount": agent.state.stepCount,
		// 	});
		// };

		// const endRunSpan = (reason: string) => {
		// 	if (!runSpan) return;
		// 	runSpan.addEvent?.("agent.run.end", {
		// 		reason,
		// 		"fragola.state.status": agent.state.status,
		// 		"fragola.state.stepCount": agent.state.stepCount,
		// 	});
		// 	runSpan.end();
		// 	runSpan = undefined;
		// };


	};
};

export default telemetry;

