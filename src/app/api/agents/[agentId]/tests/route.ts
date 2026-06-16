import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { addVoiceTestResult, getAgent, listVoiceTestResults } from "@/lib/server/builderStore";

const TranscriptTurnSchema = z.object({
  speaker: z.enum(["caller", "assistant"]),
  text: z.string().max(20000),
});

const RagChunkSchema = z.object({
  content: z.string().max(20000),
  source: z.string().max(300),
});

const MetadataSchema = z.object({
  latency_ms: z.number().min(0),
  provider: z.string().max(120),
  model: z.string().max(200),
  llm_provider: z.string().max(120).optional(),
  llm_model: z.string().max(200).optional(),
  backup_model: z.string().max(200).nullable().optional(),
  backup_used: z.boolean().optional(),
});

const SaveVoiceTestSchema = z.object({
  mode: z.enum(["audio", "llm"]),
  prompt: z.string().max(10000),
  call_id: z.string().max(200).nullable().optional(),
  transcript: z.array(TranscriptTurnSchema).max(200),
  summary: z.string().max(20000).nullable().optional(),
  recording_url: z.string().url().nullable().optional(),
  rag_chunks: z.array(RagChunkSchema).max(20).optional(),
  metadata: MetadataSchema,
});

export async function GET(_req: NextRequest, { params }: { params: { agentId: string } }) {
  const agent = getAgent(params.agentId);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ items: listVoiceTestResults(params.agentId) });
}

export async function POST(req: NextRequest, { params }: { params: { agentId: string } }) {
  const agent = getAgent(params.agentId);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });

  const parsed = SaveVoiceTestSchema.safeParse((await req.json().catch(() => null)) as unknown);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const saved = addVoiceTestResult({
    agent_id: params.agentId,
    mode: parsed.data.mode,
    prompt: parsed.data.prompt,
    call_id: parsed.data.call_id ?? null,
    transcript: parsed.data.transcript,
    summary: parsed.data.summary ?? null,
    recording_url: parsed.data.recording_url ?? null,
    rag_chunks: parsed.data.rag_chunks ?? [],
    metadata: {
      latency_ms: parsed.data.metadata.latency_ms,
      provider: parsed.data.metadata.provider,
      model: parsed.data.metadata.model,
      llm_provider: parsed.data.metadata.llm_provider,
      llm_model: parsed.data.metadata.llm_model,
      backup_model: parsed.data.metadata.backup_model ?? null,
      backup_used: parsed.data.metadata.backup_used ?? false,
    },
  });
  if (!saved) return NextResponse.json({ error: "save_failed" }, { status: 500 });

  return NextResponse.json(saved, { status: 201 });
}
