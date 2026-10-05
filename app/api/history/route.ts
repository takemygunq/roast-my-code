import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { roasts } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);
    const rows = db()
      .select()
      .from(roasts)
      .orderBy(desc(roasts.createdAt))
      .limit(limit)
      .all();
    return NextResponse.json({ roasts: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
