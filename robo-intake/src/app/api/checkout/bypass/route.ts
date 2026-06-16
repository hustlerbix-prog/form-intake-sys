import { NextRequest, NextResponse } from "next/server";
import { assertAdminAccess } from "@/lib/server/adminAuth";
import { isBypassEnabled, processBypassOrder } from "@/lib/payment/bypass";
import { BypassOrderSchema } from "@/lib/payment/schemas";

export async function POST(req: NextRequest) {
  try {
    assertAdminAccess(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isBypassEnabled())) {
    return NextResponse.json({ error: "Payment bypass is not enabled" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BypassOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    await processBypassOrder(parsed.data.orderId, parsed.data.actorId);
    return NextResponse.json({ success: true, status: "paid", bypass: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bypass failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
