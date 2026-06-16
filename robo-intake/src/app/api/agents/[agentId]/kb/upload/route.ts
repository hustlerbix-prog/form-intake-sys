import { NextResponse, type NextRequest } from "next/server";
import { addKbSourceText } from "@/lib/server/builderStore";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["txt", "md", "json"]);

export async function POST(req: NextRequest, { params }: { params: { agentId: string } }) {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File exceeds 10 MB limit" }, { status: 413 });

  const filename = file.name || "upload.txt";
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext || !ALLOWED.has(ext)) return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });

  const text = Buffer.from(await file.arrayBuffer()).toString("utf-8");
  const src = addKbSourceText({ agent_id: params.agentId, name: filename, type: "upload", text });
  if (!src) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (src.status === "failed") {
    return NextResponse.json(
      { error: { code: `kb/${src.failure_type ?? "failed"}`, message: src.error_message ?? "Ingestion failed" }, source: src },
      { status: 422 }
    );
  }
  if (src.status === "error") {
    return NextResponse.json({ error: { code: "kb/error", message: src.error_message ?? "Ingestion failed" }, source: src }, { status: 500 });
  }

  return NextResponse.json({ source: src }, { status: 201 });
}
