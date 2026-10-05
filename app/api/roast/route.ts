import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { roasts, roastEvents, providers } from "@/lib/db/schema";
import { decryptSecret } from "@/lib/crypto";
import { adapterFor } from "@/lib/providers/registry";
import { ROASTERS_MAP, type RoastResult } from "@/lib/roasters";
import type { ProviderConfig } from "@/lib/providers/types";
import { eq } from "drizzle-orm";

const RoastResultSchema = z.object({
  roasterId: z.string(),
  overallVerdict: z.string(),
  issues: z.array(
    z.object({
      severity: z.enum(["💀", "🔥", "⚠️", "💡"]),
      title: z.string(),
      description: z.string(),
      line: z.string().optional(),
    })
  ),
  score: z.number().int().min(0).max(100),
  funnyQuote: z.string(),
});

function tryDecrypt(enc: string): string {
  try {
    return decryptSecret(enc);
  } catch {
    return "";
  }
}

function sseEvent(type: string, data: object): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

function extractJSON(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return JSON.parse(fenced[1].trim());
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1) return JSON.parse(text.slice(first, last + 1));
  return JSON.parse(text.trim());
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, roasterIds, modelAssignments, inputType, inputSource } = body;

    if (!code || !roasterIds?.length) {
      return NextResponse.json({ error: "code and roasterIds required" }, { status: 400 });
    }

    const roastId = randomUUID();
    const now = new Date();

    db()
      .insert(roasts)
      .values({
        id: roastId,
        status: "pending",
        inputType: inputType ?? "paste",
        inputSource: inputSource ?? null,
        code: String(code),
        codeSnapshot: String(code).slice(0, 500),
        selectedRoasters: JSON.stringify(roasterIds),
        modelAssignments: JSON.stringify(modelAssignments ?? {}),
        results: "[]",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return NextResponse.json({ roastId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const roastId = url.searchParams.get("id");

  if (!roastId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const roast = db().select().from(roasts).where(eq(roasts.id, roastId)).get();
  if (!roast) {
    return NextResponse.json({ error: "Roast not found" }, { status: 404 });
  }

  const roasterIds: string[] = JSON.parse(roast.selectedRoasters || "[]");
  const modelAssignments: Record<string, string> = JSON.parse(roast.modelAssignments || "{}");
  const code = roast.code;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      function push(type: string, data: object) {
        try {
          controller.enqueue(enc.encode(sseEvent(type, data)));
        } catch {}
      }

      push("init", { roastId, roasterIds });

      db()
        .update(roasts)
        .set({ status: "running", updatedAt: new Date() })
        .where(eq(roasts.id, roastId))
        .run();

      const results: RoastResult[] = [];
      let seq = 0;

      await Promise.allSettled(
        roasterIds.map(async (roasterId) => {
          const roaster = ROASTERS_MAP[roasterId];
          if (!roaster) {
            push("roaster_error", { roasterId, error: "Unknown roaster" });
            return;
          }

          push("roaster_start", { roasterId });

          try {
            // Resolve model assignment
            const assignedKey = modelAssignments[roasterId];
            let providerId: string;
            let modelId: string;

            if (assignedKey && assignedKey.includes(":")) {
              const colonIdx = assignedKey.indexOf(":");
              providerId = assignedKey.slice(0, colonIdx);
              modelId = assignedKey.slice(colonIdx + 1);
            } else {
              // Use first available provider
              const allProviders = db().select().from(providers).all();
              if (allProviders.length === 0) {
                push("roaster_error", { roasterId, error: "No providers configured. Go to Settings to add one." });
                return;
              }
              const p = allProviders[0];
              providerId = p.id;
              const models: string[] = JSON.parse(p.models || "[]");
              modelId = models[0] ?? "claude-3-5-haiku-20241022";
            }

            const providerRow = db().select().from(providers).where(eq(providers.id, providerId)).get();
            if (!providerRow) {
              push("roaster_error", { roasterId, error: "Provider not found" });
              return;
            }

            const config: ProviderConfig = {
              id: providerRow.id,
              kind: providerRow.kind as ProviderConfig["kind"],
              label: providerRow.label,
              apiKey: tryDecrypt(providerRow.encryptedKey),
              baseUrl: providerRow.baseUrl ?? undefined,
            };

            const adapter = adapterFor(config.kind);
            const model = adapter.createModel(config, modelId);

            const response = await model.ask({
              system: roaster.systemPrompt,
              messages: [
                {
                  role: "user",
                  content: `Here is the code to roast:\n\n\`\`\`\n${code}\n\`\`\`\n\nAnalyze it thoroughly and respond with JSON only.`,
                },
              ],
            });

            let parsed: RoastResult;
            try {
              const json = extractJSON(response);
              const validated = RoastResultSchema.parse(json);
              parsed = { ...validated, roasterId } as RoastResult;
            } catch {
              parsed = {
                roasterId,
                overallVerdict: response.slice(0, 300),
                issues: [],
                score: 50,
                funnyQuote: "I tried to roast this but my JSON parser caught fire.",
              };
            }

            results.push(parsed);

            db()
              .insert(roastEvents)
              .values({
                roastId,
                seq: seq++,
                type: "roaster_done",
                payload: JSON.stringify(parsed),
                createdAt: new Date(),
              })
              .run();

            push("roaster_done", { roasterId, result: parsed });
          } catch (err: any) {
            const errMsg = err?.message ?? "Unknown error";
            db()
              .insert(roastEvents)
              .values({
                roastId,
                seq: seq++,
                type: "roaster_error",
                payload: JSON.stringify({ roasterId, error: errMsg }),
                createdAt: new Date(),
              })
              .run();
            push("roaster_error", { roasterId, error: errMsg });
          }
        })
      );

      const overallScore =
        results.length > 0
          ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
          : null;

      db()
        .update(roasts)
        .set({
          status: results.length > 0 ? "done" : "failed",
          results: JSON.stringify(results),
          overallScore: overallScore ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(roasts.id, roastId))
        .run();

      push("all_done", { roastId });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
