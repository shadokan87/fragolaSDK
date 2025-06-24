//@ts-nocheck
import { Agent, before, after, promptFile } from Fragola;
function main() {
    const shopBrowserCtx = {
        name: "Bob"
    }
    // The global context can be any data you want
    const globalCtx = {date: Date.now()};
    const fragola = new Fragola({globalCtx});

    const shopBrowser = fragola.Agent({ name: "shopBrowser", instructions: "You are a helpful assistant", ctx: shopBrowserCtx });

    // shopBrowser.on("toolCall", (controller, data, parse) => {
    //     if (data.name == "getWeather" && data.)
    //     const result = parse(message.toolName);
    //     return result;
    // });
    // before() event modifier let you control the flow of the agent before the llm starts generating
    // It is possible to perform any actions with the controller such as cancelling a generation, modify the context/llm parameters and more
    shopBrowser.on(before("chunk"), (controller, conversation) => {
        if (controller.ctx.name == "Bob")
            controller.abort(); // Abort will cancel any further generation or current generation
    });

    shopBrowser.on("chunk", (controller, metadata, message) => {
        // access context
        const globalCtx = controller.globalCtx;
        const ctx = controller.ctx;

        // modify context
        controller.updateCtx((prev) => ({...prev, name: "Tom"}));
        controller.updateGlobalCtx((prev) => ({...prev, date: Date.now()}));

        // update chunck data before inserted in conversation
        let newMessage = structuredClone(message);
        newMessage.tool_calls[0].content = "";
        return newMessage;
    });

    // `after()` event modifier behaves exactly like `before()` but happens after the generation is over
    shopBrowser.on(after("chunk"), (controller, conversation) => {
        console.log("")
    });
    let conversation = [];
    // Any new chunck or new message will trigger this event
    shopBrowser.on("conversationUpdate", (_, conversation) => conversation = conversation);
    shopBrowser.userMessage({content: "Is the universe infinite ?"});
}

main();