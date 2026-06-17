import { CheerioCrawler, type CheerioCrawlingContext } from "@crawlee/cheerio";
import {tool} from "@fragola-ai/agent";
import type { AgentAny } from "@fragola-ai/agent/agent";
import type { FragolaHook } from "@fragola-ai/agent/hook";
import z from "zod";

export const crawlerInstructionName = "crawler";

const crawlerInstructions = [
    "Use the web page crawler tool when you need to fetch one or more web pages.",
    "The tool output is a single string containing one block per crawled URL.",
    "Each block starts with '-- page begin url <the_url_crawled> --' and ends with '-- page end --'.",
    "Use the page content exactly as returned by the tool when quoting or analyzing fetched pages."
].join("\n");

export const crawlerTool = tool({
    name: "web page crawler",
    description: "Fetch one or more web pages with CheerioCrawler and return their HTML in delimited text blocks.",
    schema: z.object({
        urls: z.array(z.string().url()).min(1).max(5).describe("One or more urls to crawl")
    }),
    async handler(params) {
        const {urls} = params;
        type CrawlerUserData = { inputUrl: string };

        const pages = new Map<string, { crawledUrl: string; content: string }>();

        const crawler = new CheerioCrawler({
            maxRequestsPerCrawl: urls.length,
            async requestHandler({ request, $ }: CheerioCrawlingContext<CrawlerUserData>) {
                const inputUrl = String(request.userData.inputUrl ?? request.url);
                const crawledUrl = request.loadedUrl ?? request.url;
                pages.set(inputUrl, {
                    crawledUrl,
                    content: $.root().html() ?? ""
                });
            },
            async failedRequestHandler({ request, error }: CheerioCrawlingContext<CrawlerUserData>) {
                const inputUrl = String(request.userData.inputUrl ?? request.url);
                const crawledUrl = request.loadedUrl ?? request.url;
                const message = error instanceof Error ? error.message : String(error);
                pages.set(inputUrl, {
                    crawledUrl,
                    content: `Failed to crawl page: ${message}`
                });
            }
        });

        await crawler.run(urls.map((url) => ({ url, userData: { inputUrl: url } })));

        return urls.map((url) => {
            const page = pages.get(url) ?? {
                crawledUrl: url,
                content: "Failed to crawl page: no content returned."
            };
            return `-- page begin url ${page.crawledUrl} --\n${page.content}\n-- page end --`;
        }).join("\n\n");
    }
});

export const crawlerHook: FragolaHook = (agent: AgentAny) => {
    agent.context.setInstructions(crawlerInstructions, crawlerInstructionName);
    agent.context.updateTools((prev) => {
        return [...prev, crawlerTool];
    });

    return () => {
            agent.context.removeInstructions(crawlerInstructionName);
            agent.context.updateTools((prev) => (prev.filter(tool => tool.name != crawlerTool.name)))
    }
}

export default crawlerHook;