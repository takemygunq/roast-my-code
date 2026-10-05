import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { providers } from "@/lib/db/schema";
import { encryptSecret, maskSecret, decryptSecret } from "@/lib/crypto";
import { isProviderKind } from "@/lib/providers/registry";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const rows = db().select().from(providers).all();
    return NextResponse.json({
      providers: rows.map((p) => ({
        ...p,
        encryptedKey: p.encryptedKey ? maskSecret(tryDecrypt(p.encryptedKey)) : "",
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { kind, label, apiKey, baseUrl } = body;
    if (!kind || !label) {
      return NextResponse.json({ error: "kind and label required" }, { status: 400 });
    }
    if (!isProviderKind(kind)) {
      return NextResponse.json({ error: `Unknown provider kind: ${kind}` }, { status: 400 });
    }
    const now = new Date();
    const id = randomUUID();
    db().insert(providers).values({
      id,
      kind,
      label,
      encryptedKey: apiKey ? encryptSecret(apiKey) : "",
      baseUrl: baseUrl ?? null,
      models: "[]",
      createdAt: now,
      updatedAt: now,
    }).run();
    return NextResponse.json({ id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function tryDecrypt(enc: string): string {
  try { return decryptSecret(enc); } catch { return ""; }
}
