import { Fragola } from "@fragola-ai/agent";
import bun from "bun";
import crawlerHook from "./fragolaHooks/crawler";
import { createWorkspaceHook } from "./fragolaHooks/workspace";

async function main() {
    const pwd = process.env["PWD"];
    if (!pwd) {
        throw new Error("Failed to retrieve PWD from env");
    }
    const args = process.argv.slice(2);
    const fragola = new Fragola({
        model: ""
    });

    const kaggleProblemSolverAgent = fragola.agent({
        name: "kaggle problem solver",
        description: "",
        instructions: "you will solve kaggle machine learning problems by providing the required files asked in the problem."
    })
    .use(crawlerHook, "crawler")
    .use(createWorkspaceHook(pwd))
    .use(probablSkills)


}