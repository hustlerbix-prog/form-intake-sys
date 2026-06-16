import { NextResponse, type NextRequest } from "next/server";
import { addKbSourceText, getAgent } from "@/lib/server/builderStore";
import { readFile } from "fs/promises";
import path from "path";

const DOC_FILES = [
  "BA-002_SCRAPER_BUILD_INSTRUCTIONS.md",
  "BA-004_BUILD_INSTRUCTIONS.md",
  "WEB-007_BUILD_INSTRUCTIONS.md",
];

export async function POST(_req: NextRequest, { params }: { params: { agentId: string } }) {
  const agent = getAgent(params.agentId);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });

  const docsDir = path.resolve(process.cwd(), "..", "Docs");
  const loaded: string[] = [];
  const skipped: string[] = [];

  for (const filename of DOC_FILES) {
    try {
      const abs = path.join(docsDir, filename);
      const content = await readFile(abs, "utf-8");
      const src = addKbSourceText({
        agent_id: params.agentId,
        name: `DOC: ${filename}`,
        type: "text",
        text: content,
      });
      if (src) loaded.push(filename);
      else skipped.push(filename);
    } catch {
      skipped.push(filename);
    }
  }

  return NextResponse.json({ loaded, skipped });
}

