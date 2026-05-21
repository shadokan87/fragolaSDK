import { readFile } from "node:fs/promises";

import type { ResolvedSkillFile } from "./types";

function looksBinary(content: Buffer) {
  return content.includes(0);
}

function renderFileBlock(file: ResolvedSkillFile, content: string) {
  return `-- begin: ${file.url} --\n${content}\n-- end: ${file.url} --`;
}

export async function readResolvedSkillFiles(files: ResolvedSkillFile[]) {
  const renderedFiles = await Promise.all(files.map(async (file) => {
    const content = await readFile(file.absolutePath);

    if (looksBinary(content)) {
      return renderFileBlock(
        file,
        `[binary ${file.kind} omitted]\nlocal-path: ${file.absolutePath}`,
      );
    }

    return renderFileBlock(file, content.toString("utf8"));
  }));

  return renderedFiles.join("\n\n");
}
