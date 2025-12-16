import { Fragola, tool, type ClientOptions } from "@src/fragola";
import { createHeaders, PORTKEY_GATEWAY_URL } from "portkey-ai";
import { telemetry } from "./src/hook/presets";
import { type SpanExporter, type ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { NodeSDK } from "@opentelemetry/sdk-node";
import * as otel from "@opentelemetry/api";
import fs from "node:fs";
import path from "node:path";

class FileSpanExporter implements SpanExporter {
  constructor(private filePath: string) { }

  export(spans: ReadableSpan[], resultCallback: (result: { code: number }) => void): void {
    try {
      const dir = path.dirname(this.filePath);
      fs.mkdirSync(dir, { recursive: true });

      const lines = spans.map((span) =>
        JSON.stringify({
          name: span.name,
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
          startTime: span.startTime,
          endTime: span.endTime,
          attributes: span.attributes,
          events: span.events,
          status: span.status,
        })
      );

      fs.appendFileSync(this.filePath, lines.join("\n") + "\n", "utf8");
      resultCallback({ code: 0 });
    } catch (err) {
      console.error("FileSpanExporter error", err);
      resultCallback({ code: 1 });
    }
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

const createSdk = () => {
  const filePath = path.resolve("./otel-traces.jsonl");
  const exporter = new FileSpanExporter(filePath);

  const sdk = new NodeSDK({
    traceExporter: exporter,
  });

  return sdk;
};

const createTestClient = (opts?: ClientOptions) => {
  const defaultOpts: ClientOptions = {
    baseURL: PORTKEY_GATEWAY_URL,
    apiKey: "xxx",
    defaultHeaders: createHeaders({
      virtualKey: "google-966377",
      apiKey: process.env["TEST_API_KEY"],
      Authorization: `Bearer ${process.env["TEST_GCLOUD_AUTH_TOKEN"]}`
    }),
    model: process.env["TEST_MODEL_MEDIUM"]!,
    events: {
      agentCreated(agent) {
        agent.use(
				telemetry(otel, {
            serviceName: "fragola-telemetry-test",
            tracerName: "fragola-agent-telemetry-test",
          })
        );
      }
    }
  }
  const _opts = opts ? { ...opts, ...defaultOpts } : defaultOpts;
  return new Fragola(_opts);
};

const run = async () => {
  const sdk = createSdk();
  await sdk.start();
  const fragola = createTestClient();

  const assistant = fragola
    .agent({
      name: "assistant",
      description: "",
      instructions: "you are a helpful assistant",
      modelSettings: {
        model: fragola.options.model,
        tool_choice: "auto",
        max_tokens: 5000,
        stream: true,
      },
    });

  console.log("#br - starting telemetry test");

  try {
    await assistant.userMessage({ content: "say hello world" });
  } catch (err) {
    console.error("Error during telemetry test run", err);
  } finally {
    await sdk.shutdown();
  }
};

run().catch((err) => {
  console.error("Unhandled error in telemetry test runner", err);
});