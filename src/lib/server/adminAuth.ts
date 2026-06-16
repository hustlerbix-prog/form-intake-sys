import type { NextRequest } from "next/server";

export function assertAdminAccess(req: NextRequest): void {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return;
  const fromHeader = req.headers.get("x-admin-token");
  const fromQuery = req.nextUrl.searchParams.get("token");
  const provided = fromHeader || fromQuery;
  if (provided !== token) {
    throw new Error("unauthorized");
  }
}

