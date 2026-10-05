"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface RoastRow {
  id: string;
  status: string;
  inputType: string;
  inputSource: string | null;
  codeSnapshot: string | null;
  selectedRoasters: string;
  overallScore: number | null;
  createdAt: number;
}

export default function HistoryPage() {
  const [roasts, setRoasts] = useState<RoastRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((data) => {
        setRoasts(data.roasts ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function formatDate(ts: number) {
    return new Date(ts * 1000).toLocaleString();
  }

  function statusColor(status: string) {
    if (status === "done") return "var(--success)";
    if (status === "running") return "var(--fire)";
    if (status === "failed") return "var(--danger)";
    return "var(--text-3)";
  }

  function scoreColor(score: number | null) {
    if (score === null) return "var(--text-3)";
    if (score >= 75) return "var(--success)";
    if (score >= 50) return "var(--warning, #f59e0b)";
    if (score >= 25) return "var(--fire)";
    return "var(--danger)";
  }

  return (
    <div className="min-h-full">
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="max-w-5xl mx-auto px-8 py-5">
          <h1 className="font-bold" style={{ fontSize: 20, color: "var(--text)" }}>
            📋 Roast History
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-2)", marginTop: 2 }}>
            All your past code roasts
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-6">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl animate-pulse-slow"
                style={{ height: 72, background: "var(--surface)", border: "1px solid var(--border)" }}
              />
            ))}
          </div>
        )}

        {!loading && roasts.length === 0 && (
          <div className="text-center py-24">
            <p style={{ fontSize: 32, marginBottom: 12 }}>🔥</p>
            <p style={{ fontSize: 16, color: "var(--text-2)", fontWeight: 500 }}>No roasts yet</p>
            <p style={{ fontSize: 14, color: "var(--text-3)", marginTop: 4 }}>
              Go back to{" "}
              <Link href="/" style={{ color: "var(--accent)" }}>
                Home
              </Link>{" "}
              and get your code roasted
            </p>
          </div>
        )}

        {!loading && roasts.length > 0 && (
          <div className="space-y-3">
            {roasts.map((roast) => {
              const roasterIds: string[] = JSON.parse(roast.selectedRoasters || "[]");
              return (
                <Link
                  key={roast.id}
                  href={`/roast/${roast.id}`}
                  className="block rounded-2xl px-5 py-4 transition-all"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="px-2 py-0.5 rounded-full"
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            background: `${statusColor(roast.status)}22`,
                            color: statusColor(roast.status),
                            textTransform: "capitalize",
                          }}
                        >
                          {roast.status}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                          {formatDate(roast.createdAt)}
                        </span>
                      </div>

                      {roast.inputSource && (
                        <p className="font-medium truncate" style={{ fontSize: 14, color: "var(--text)" }}>
                          {roast.inputSource}
                        </p>
                      )}

                      {roast.codeSnapshot && (
                        <p
                          className="font-mono truncate mt-1"
                          style={{ fontSize: 12, color: "var(--text-2)" }}
                        >
                          {roast.codeSnapshot.slice(0, 120)}
                        </p>
                      )}

                      <div className="flex gap-1.5 mt-2">
                        {roasterIds.slice(0, 6).map((rid) => (
                          <span
                            key={rid}
                            className="px-2 py-0.5 rounded-full"
                            style={{ fontSize: 11, background: "var(--bg)", color: "var(--text-2)", border: "1px solid var(--border)" }}
                          >
                            {rid}
                          </span>
                        ))}
                      </div>
                    </div>

                    {roast.overallScore !== null && (
                      <div
                        className="shrink-0 flex flex-col items-center"
                        style={{ minWidth: 52 }}
                      >
                        <span
                          className="font-bold"
                          style={{ fontSize: 22, color: scoreColor(roast.overallScore), lineHeight: 1 }}
                        >
                          {roast.overallScore}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>/100</span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
