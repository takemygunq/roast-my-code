import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { providers } from "@/lib/db/schema";
import { encryptSecret, maskSecret, decryptSecret } from "@/lib/crypto";
import { adapterFor } from "@/lib/providers/registry";
import { eq } from "drizzle-orm";
import type { ProviderConfig } from "@/lib/providers/types";

function tryDecrypt(enc: string): string {
  try { return decryptSecret(enc); } catch { return ""; }
}

function getProvider(id: string) {
  return db().select().from(providers).where(eq(providers.id, id)).get();
}

function toConfig(p: typeof providers.$inferSelect): ProviderConfig {
  return {
    id: p.id,
    kind: p.kind as ProviderConfig["kind"],
    label: p.label,
    apiKey: tryDecrypt(p.encryptedKey),
    baseUrl: p.baseUrl ?? undefined,
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getProvider(id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ...p,
    encryptedKey: p.encryptedKey ? maskSecret(tryDecrypt(p.encryptedKey)) : "",
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getProvider(id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const update: Partial<typeof providers.$inferInsert> = { updatedAt: new Date() };
  if (body.label) update.label = body.label;
  if (body.baseUrl !== undefined) update.baseUrl = body.baseUrl || null;
  if (body.apiKey) update.encryptedKey = encryptSecret(body.apiKey);
  db().update(providers).set(update).where(eq(providers.id, id)).run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db().delete(providers).where(eq(providers.id, id)).run();
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const action = url.pathname.endsWith("/check") ? "check" : url.pathname.endsWith("/models") ? "models" : "";

  const p = getProvider(id);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const config = toConfig(p);
  const adapter = adapterFor(config.kind);

  if (action === "check") {
    try {
      const result = await adapter.healthCheck(config);
      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json({ ok: false, error: err.message });
    }
  }

  if (action === "models") {
    try {
      const models = await adapter.listModels(config);
      const modelIds = models.map((m) => m.id);
      db().update(providers)
        .set({ models: JSON.stringify(modelIds), updatedAt: new Date() })
        .where(eq(providers.id, id))
        .run();
      return NextResponse.json({ models: modelIds });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
