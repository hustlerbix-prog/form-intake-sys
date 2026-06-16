import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eraseProfile } from "@/lib/server/store";

const Body = z.object({ profile_id: z.string().uuid() });

export async function DELETE(req: NextRequest) {
  const body = Body.parse(await req.json());
  const ok = eraseProfile({ profile_id: body.profile_id });
  return NextResponse.json({ erased: ok });
}

