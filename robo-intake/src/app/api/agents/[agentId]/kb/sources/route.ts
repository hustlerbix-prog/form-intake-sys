import { NextResponse, type NextRequest } from "next/server";
import { listKbSources } from "@/lib/server/builderStore";

export async function GET(_req: NextRequest, { params }: { params: { agentId: string } }) {
  return NextResponse.json({ sources: listKbSources(params.agentId) });
}

