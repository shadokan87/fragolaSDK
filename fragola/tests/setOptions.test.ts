import z from "zod";
import { tool, type Tool } from "../fragola";
import { fragolaTest, TestFailError } from "./test";
import { BadUsage } from "../exceptions";

export async function setOptionsTest() {
    let testTools: Tool<any>[] = [];

    for (let i = 0; i < 5; i++) {
        testTools.push(tool({
            name: `testTool-${i}`,
            description: "",
            schema: z.object({}),
            handler: async () => {
                return `test tool number ${i} called successfully`
            }
        }))
    }

    const testAgent = fragolaTest.agent({
        name: "test", instructions: "You are an agent performing unit tests, answer like a helpful assistant you may be asked to call test tools.", tools: testTools,
        modelSettings: {
            model: 'us.anthropic.claude-3-5-haiku-20241022-v1:0' as any,
            temperature: 1,
            stream: true,
            tool_choice: "required"
        }
    });

    testAgent.onAfterStateUpdate((context) => {
        if (context.state.status != "idle") {
            try {
                context.setOptions({
                    ...testAgent.options,
                    instructions: "You are a helpful assistant"
                });
                throw new TestFailError("context.setOptions not supposed to work when agent status is not idle");
            } catch (e) {
                if (e instanceof BadUsage && e.message.includes("Cannot change options")) {
                    console.log("passed: setOptions while idle");
                }
            }
        }
    });

}

await setOptionsTest();