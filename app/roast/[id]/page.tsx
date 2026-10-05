"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ROASTERS_MAP, type RoastResult } from "@/lib/roasters";

interface StreamEvent {
  type: string;
  roasterId?: string;
  result?: RoastResult;
  error?: string;
}

interface RoasterState {
  status: "waiting" | "running" | "done" | "error";
  result?: RoastResult;
  error?: string;
}

export default function RoastPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [states, setStates] = useState<Record<string, RoasterState>>({});
  const [allDone, setAllDone] = useState(false);
  const [roasterIds, setRoasterIds] = useState<string[]>([]);
  const [globalError, setGlobalError] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!id) return;
    const es = new EventSource(`/api/roast?id=${id}`);
    eventSourceRef.current = es;

    es.addEventListener("roaster_start", (e) => {
      const data: StreamEvent = JSON.parse(e.data);
      if (!data.roasterId) return;
      setRoasterIds((prev) => prev.includes(data.roasterId!) ? prev : [...prev, data.roasterId!]);
      setStates((prev) => ({ ...prev, [data.roasterId!]: { status: "running" } }));
    });

    es.addEventListener("roaster_done", (e) => {
      const data: StreamEvent = JSON.parse(e.data);
      if (!data.roasterId || !data.result) return;
      setStates((prev) => ({
        ...prev,
        [data.roasterId!]: { status: "done", result: data.result },
      }));
    });

    es.addEventListener("roaster_error", (e) => {
      const data: StreamEvent = JSON.parse(e.data);
      if (!data.roasterId) return;
      setStates((prev) => ({
        ...prev,
        [data.roasterId!]: { status: "error", error: data.error },
      }));
    });

    es.addEventListener("all_done", () => {
      setAllDone(true);
      es.close();
    });

    es.addEventListener("init", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.roasterIds) {
          setRoasterIds(data.roasterIds);
          const initial: Record<string, RoasterState> = {};
          for (const rid of data.roasterIds) {
            initial[rid] = { status: "waiting" };
          }
          setStates(initial);
        }
      } catch {}
    });

    es.onerror = () => {
      setGlobalError("Connection lost. The roast may have failed.");
      es.close();
    };

    return () => {
      es.close();
    };
  }, [id]);

  const doneResults = Object.values(states)
    .filter((s) => s.status === "done" && s.result)
    .map((s) => s.result!);

  const overallScore =
    doneResults.length > 0
      ? Math.round(doneResults.reduce((sum, r) => sum + r.score, 0) / doneResults.length)
      : null;

  function getWorstIssues() {
    if (doneResults.length < 2) return [];
    const titleCounts: Record<string, { count: number; issue: any; severity: string }> = {};
    for (const result of doneResults) {
      for (const issue of result.issues) {
        const key = issue.title.toLowerCase().replace(/\s+/g, " ").slice(0, 40);
        if (!titleCounts[key]) {
          titleCounts[key] = { count: 0, issue, severity: issue.severity };
        }
        titleCounts[key].count++;
      }
    }
    return Object.values(titleCounts)
      .filter((v) => v.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  function handleCopyShare() {
    const lines = [`🔥 Roast My Code Results\n`];
    if (overallScore !== null) {
      lines.push(`Overall Score: ${overallScore}/100\n`);
    }
    for (const result of doneResults) {
      const roaster = ROASTERS_MAP[result.roasterId];
      lines.push(`\n${roaster?.emoji ?? "🤖"} ${roaster?.name ?? result.roasterId}`);
      lines.push(`Score: ${result.score}/100`);
      lines.push(`Verdict: ${result.overallVerdict}`);
      lines.push(`"${result.funnyQuote}"`);
    }
    navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
  }

  const worstIssues = getWorstIssues();

  return (
    <div className="min-h-full">
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="max-w-5xl mx-auto px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold" style={{ fontSize: 18, color: "var(--text)" }}>
              🔥 Code Roast in Progress
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>
              {allDone
                ? `${doneResults.length} judges delivered their verdict`
                : `${doneResults.length} of ${roasterIds.length} judges done…`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-2)" }}
            >
              Roast Again
            </button>
            {allDone && (
              <button
                onClick={handleCopyShare}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity"
                style={{ background: "var(--accent)" }}
              >
                Share Results
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-6 space-y-6">
        {globalError && (
          <div
            className="px-4 py-3 rounded-xl text-sm"
            style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "var(--danger)" }}
          >
            {globalError}
          </div>
        )}

        {/* Aggregate panel — shown when all done */}
        {allDone && doneResults.length > 0 && (
          <div
            className="rounded-2xl p-6"
            style={{
              background: "linear-gradient(135deg, #1a1f2e 0%, #2a3050 100%)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div className="flex items-start gap-8">
              <ScoreRing score={overallScore ?? 0} size={100} />
              <div className="flex-1">
                <h2 className="font-bold text-white mb-1" style={{ fontSize: 18 }}>
                  Aggregate Verdict
                </h2>
                <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, marginBottom: 12 }}>
                  Average across {doneResults.length} judges
                </p>
                {worstIssues.length > 0 && (
                  <div>
                    <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Recurring Issues
                    </p>
                    <div className="space-y-2">
                      {worstIssues.map((wi, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 px-3 py-2 rounded-lg"
                          style={{ background: "rgba(255,255,255,0.06)" }}
                        >
                          <span style={{ fontSize: 14 }}>{wi.severity}</span>
                          <div>
                            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
                              {wi.issue.title}
                            </span>
                            <span
                              className="ml-2 px-2 py-0.5 rounded-full"
                              style={{ fontSize: 10, background: "rgba(255,107,53,0.25)", color: "#ff9e7a" }}
                            >
                              {wi.count}/{doneResults.length} judges
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Per-roaster cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roasterIds.map((rid) => {
            const state = states[rid];
            const roaster = ROASTERS_MAP[rid];
            if (!roaster) return null;
            return (
              <RoasterCard
                key={rid}
                roaster={roaster}
                state={state ?? { status: "waiting" }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RoasterCard({
  roaster,
  state,
}: {
  roaster: { id: string; name: string; emoji: string; tagline: string };
  state: RoasterState;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden roaster-card-enter"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Card header */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span style={{ fontSize: 22 }}>{roaster.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold" style={{ fontSize: 14, color: "var(--text)" }}>
            {roaster.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)" }}>{roaster.tagline}</div>
        </div>
        {state.status === "done" && state.result && (
          <ScoreRing score={state.result.score} size={48} />
        )}
        {state.status === "running" && (
          <div
            className="px-2.5 py-1 rounded-full animate-pulse-slow"
            style={{ background: "rgba(255,107,53,0.1)", border: "1px solid rgba(255,107,53,0.3)" }}
          >
            <span style={{ fontSize: 11, color: "var(--fire)", fontWeight: 600 }}>Roasting…</span>
          </div>
        )}
        {state.status === "waiting" && (
          <div
            className="px-2.5 py-1 rounded-full"
            style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
          >
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>Waiting</span>
          </div>
        )}
        {state.status === "error" && (
          <div
            className="px-2.5 py-1 rounded-full"
            style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
          >
            <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 600 }}>Error</span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="px-5 py-4">
        {state.status === "waiting" && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded animate-pulse-slow"
                style={{ height: 12, background: "var(--bg)", width: `${70 + i * 8}%` }}
              />
            ))}
          </div>
        )}

        {state.status === "running" && (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded animate-pulse-slow"
                style={{
                  height: 12,
                  background: "rgba(255,107,53,0.08)",
                  width: `${60 + (i % 3) * 12}%`,
                }}
              />
            ))}
          </div>
        )}

        {state.status === "error" && (
          <p style={{ fontSize: 13, color: "var(--danger)" }}>
            {state.error ?? "This judge had a meltdown."}
          </p>
        )}

        {state.status === "done" && state.result && (
          <RoastResultView result={state.result} />
        )}
      </div>
    </div>
  );
}

function RoastResultView({ result }: { result: RoastResult }) {
  return (
    <div className="space-y-4">
      {/* Verdict */}
      <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6 }}>
        {result.overallVerdict}
      </p>

      {/* Funny quote */}
      <div
        className="px-4 py-3 rounded-xl"
        style={{ background: "rgba(255,107,53,0.06)", borderLeft: "3px solid var(--fire)" }}
      >
        <p style={{ fontSize: 13, color: "var(--fire)", fontStyle: "italic" }}>
          &ldquo;{result.funnyQuote}&rdquo;
        </p>
      </div>

      {/* Issues */}
      {result.issues.length > 0 && (
        <div className="space-y-2">
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Issues Found
          </p>
          {result.issues.map((issue, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
              style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
            >
              <span style={{ fontSize: 14, marginTop: 1 }}>{issue.severity}</span>
              <div className="min-w-0">
                <div className="font-medium" style={{ fontSize: 12, color: "var(--text)" }}>
                  {issue.title}
                  {issue.line && (
                    <span
                      className="ml-2 px-1.5 py-0.5 rounded font-mono"
                      style={{ fontSize: 10, background: "rgba(79,107,255,0.1)", color: "var(--accent)" }}
                    >
                      {issue.line}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2, lineHeight: 1.5 }}>
                  {issue.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreRing({ score, size }: { score: number; size: number }) {
  const r = (size - 6) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 75 ? "var(--success)" :
    score >= 50 ? "var(--warning)" :
    score >= 25 ? "var(--fire)" :
    "var(--danger)";

  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ fontSize: size > 60 ? 20 : 12, fontWeight: 700, color }}
      >
        {score}
        {size > 60 && <span style={{ fontSize: 11, fontWeight: 400, color: "rgba(255,255,255,0.5)" }}>/100</span>}
      </div>
    </div>
  );
}
