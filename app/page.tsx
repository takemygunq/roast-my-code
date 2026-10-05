"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ROASTERS } from "@/lib/roasters";

interface ProviderRow {
  id: string;
  label: string;
  kind: string;
  models: string[];
}

type InputTab = "paste" | "github" | "file";

export default function HomePage() {
  const router = useRouter();
  const [tab, setTab] = useState<InputTab>("paste");
  const [code, setCode] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileCode, setFileCode] = useState("");
  const [selectedRoasters, setSelectedRoasters] = useState<Set<string>>(
    new Set(["senior", "security", "performance"])
  );
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [modelAssignments, setModelAssignments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fetchingRepo, setFetchingRepo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((data) => {
        const rows: ProviderRow[] = (data.providers ?? []).map((p: any) => ({
          id: p.id,
          label: p.label,
          kind: p.kind,
          models: JSON.parse(p.models ?? "[]"),
        }));
        setProviders(rows);
      })
      .catch(() => {});
  }, []);

  function toggleRoaster(id: string) {
    setSelectedRoasters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function setModel(roasterId: string, val: string) {
    setModelAssignments((prev) => ({ ...prev, [roasterId]: val }));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (file.name.endsWith(".zip")) {
      const formData = new FormData();
      formData.append("file", file);
      setFetchingRepo(true);
      try {
        const res = await fetch("/api/fetch-repo", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to process zip");
        setFileCode(data.code);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setFetchingRepo(false);
      }
    } else {
      const text = await file.text();
      setFileCode(text);
    }
  }

  async function handleFetchGithub() {
    if (!githubUrl.trim()) return;
    setFetchingRepo(true);
    setError("");
    try {
      const res = await fetch("/api/fetch-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: githubUrl, type: "github" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch repo");
      setFileCode(data.code);
      if (data.fileCount) {
        setFileName(`${data.fileCount} files from GitHub`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFetchingRepo(false);
    }
  }

  function getActiveCode(): string {
    if (tab === "paste") return code;
    return fileCode;
  }

  async function handleSubmit() {
    const activeCode = getActiveCode();
    if (!activeCode.trim()) {
      setError("Please provide some code to roast");
      return;
    }
    if (selectedRoasters.size === 0) {
      setError("Select at least one roaster");
      return;
    }

    const defaultModel = buildDefaultModel();
    if (!defaultModel) {
      setError("No providers configured. Go to Settings to add a provider.");
      return;
    }

    setLoading(true);
    setError("");

    const assignments: Record<string, string> = {};
    for (const id of selectedRoasters) {
      assignments[id] = modelAssignments[id] ?? defaultModel;
    }

    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: activeCode,
          roasterIds: Array.from(selectedRoasters),
          modelAssignments: assignments,
          inputType: tab,
          inputSource: tab === "github" ? githubUrl : fileName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start roast");
      router.push(`/roast/${data.roastId}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  function buildDefaultModel(): string | null {
    for (const p of providers) {
      const models = p.models;
      if (models.length > 0) return `${p.id}:${models[0]}`;
      return `${p.id}:default`;
    }
    return null;
  }

  function allModelOptions(): { value: string; label: string }[] {
    const opts: { value: string; label: string }[] = [];
    for (const p of providers) {
      if (p.models.length === 0) {
        opts.push({ value: `${p.id}:default`, label: `${p.label} (default)` });
      } else {
        for (const m of p.models) {
          opts.push({ value: `${p.id}:${m}`, label: `${p.label} · ${m}` });
        }
      }
    }
    return opts;
  }

  const modelOptions = allModelOptions();

  return (
    <div className="min-h-full">
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1a1f2e 0%, #2a3050 100%)" }}>
        <div className="max-w-5xl mx-auto px-8 py-12 flex items-center gap-10">
          <div className="flex-1">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
              style={{ background: "rgba(255,107,53,0.15)", border: "1px solid rgba(255,107,53,0.3)" }}
            >
              <span style={{ fontSize: 13, color: "var(--fire)" }}>🔥 AI-powered code review with attitude</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-3 leading-tight">
              Roast My Code
            </h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, maxWidth: 480 }}>
              Six AI judges with distinct personalities will mercilessly critique your code.
              Senior devs, security auditors, performance nerds, and more — all running simultaneously.
            </p>
          </div>
          <div className="hidden md:block shrink-0">
            <Image
              src="/assets/hero.png"
              alt="Developer shocked by burning code monitor"
              width={260}
              height={200}
              className="rounded-2xl object-cover"
              style={{ opacity: 0.9 }}
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Input */}
          <div className="lg:col-span-2 space-y-5">
            {/* Input card */}
            <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <h2 className="font-semibold mb-4" style={{ color: "var(--text)", fontSize: 15 }}>
                Submit Code
              </h2>

              {/* Tabs */}
              <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: "var(--bg)" }}>
                {(["paste", "github", "file"] as InputTab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="flex-1 py-2 rounded-md text-sm font-medium transition-all"
                    style={{
                      background: tab === t ? "var(--surface)" : "transparent",
                      color: tab === t ? "var(--text)" : "var(--text-2)",
                      boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                      fontSize: 13,
                    }}
                  >
                    {t === "paste" ? "📝 Paste Code" : t === "github" ? "🐙 GitHub URL" : "📁 Upload File"}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {tab === "paste" && (
                <textarea
                  className="code-input w-full rounded-xl p-4 outline-none"
                  style={{
                    height: 280,
                    background: "#0d1117",
                    color: "#e6edf3",
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: 13,
                  }}
                  placeholder="// Paste your code here..."
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  spellCheck={false}
                />
              )}

              {tab === "github" && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-4 py-2.5 rounded-xl outline-none"
                      style={{
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                        fontSize: 14,
                      }}
                      placeholder="https://github.com/owner/repo or .../blob/main/file.ts"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleFetchGithub()}
                    />
                    <button
                      onClick={handleFetchGithub}
                      disabled={fetchingRepo || !githubUrl.trim()}
                      className="px-4 py-2.5 rounded-xl font-medium text-white text-sm transition-opacity"
                      style={{ background: "var(--accent)", opacity: fetchingRepo ? 0.6 : 1 }}
                    >
                      {fetchingRepo ? "Fetching…" : "Fetch"}
                    </button>
                  </div>
                  {fileCode && (
                    <div
                      className="rounded-xl p-3 font-mono"
                      style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", color: "#8b949e", fontSize: 12, maxHeight: 200, overflow: "auto" }}
                    >
                      <div style={{ color: "#3fb950", marginBottom: 4, fontSize: 11 }}>
                        ✓ {fileName || "Code fetched"} — {fileCode.length.toLocaleString()} chars
                      </div>
                      <pre className="truncate">{fileCode.slice(0, 500)}{fileCode.length > 500 ? "…" : ""}</pre>
                    </div>
                  )}
                </div>
              )}

              {tab === "file" && (
                <div className="space-y-3">
                  <div
                    className="rounded-xl flex flex-col items-center justify-center py-10 cursor-pointer transition-colors"
                    style={{ border: "2px dashed var(--border)", background: "var(--bg)" }}
                    onClick={() => fileRef.current?.click()}
                  >
                    <span style={{ fontSize: 32, marginBottom: 8 }}>📂</span>
                    <p style={{ color: "var(--text-2)", fontSize: 14 }}>
                      Click to upload a code file or .zip archive
                    </p>
                    <p style={{ color: "var(--text-3)", fontSize: 12, marginTop: 4 }}>
                      .ts .js .py .go .rs .java and more
                    </p>
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                      accept=".ts,.tsx,.js,.jsx,.mjs,.cjs,.py,.rs,.go,.java,.kt,.swift,.cpp,.c,.h,.cs,.rb,.php,.lua,.zip"
                    />
                  </div>
                  {fetchingRepo && (
                    <p style={{ color: "var(--text-2)", fontSize: 13 }}>Extracting zip…</p>
                  )}
                  {fileCode && !fetchingRepo && (
                    <div
                      className="rounded-xl p-3 font-mono"
                      style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", color: "#8b949e", fontSize: 12, maxHeight: 200, overflow: "auto" }}
                    >
                      <div style={{ color: "#3fb950", marginBottom: 4, fontSize: 11 }}>
                        ✓ {fileName} — {fileCode.length.toLocaleString()} chars
                      </div>
                      <pre className="truncate">{fileCode.slice(0, 500)}{fileCode.length > 500 ? "…" : ""}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div
                className="px-4 py-3 rounded-xl text-sm"
                style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "var(--danger)" }}
              >
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-white transition-all"
              style={{
                background: loading
                  ? "rgba(255,107,53,0.5)"
                  : "linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)",
                fontSize: 15,
                boxShadow: loading ? "none" : "0 4px 16px rgba(255,107,53,0.35)",
              }}
            >
              {loading ? "Starting roast…" : "Get Roasted 🔥"}
            </button>
          </div>

          {/* Right: Roaster selection + model assignment */}
          <div className="space-y-5">
            {/* Roasters */}
            <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <h2 className="font-semibold mb-4" style={{ color: "var(--text)", fontSize: 15 }}>
                Choose Judges
              </h2>
              <div className="space-y-2">
                {ROASTERS.map((r) => {
                  const active = selectedRoasters.has(r.id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => toggleRoaster(r.id)}
                      className="w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all"
                      style={{
                        background: active ? "rgba(79,107,255,0.08)" : "var(--bg)",
                        border: active ? "1px solid rgba(79,107,255,0.3)" : "1px solid var(--border)",
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{r.emoji}</span>
                      <div className="min-w-0">
                        <div className="font-medium" style={{ fontSize: 13, color: "var(--text)" }}>
                          {r.name}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 1 }}>
                          {r.tagline}
                        </div>
                      </div>
                      {active && (
                        <div
                          className="ml-auto shrink-0 flex items-center justify-center rounded-full"
                          style={{ width: 18, height: 18, background: "var(--accent)" }}
                        >
                          <span style={{ color: "white", fontSize: 10, lineHeight: 1 }}>✓</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Model assignment */}
            {modelOptions.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <h2 className="font-semibold mb-1" style={{ color: "var(--text)", fontSize: 15 }}>
                  Model per Judge
                </h2>
                <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 12 }}>
                  Optionally assign different models
                </p>
                <div className="space-y-2">
                  {Array.from(selectedRoasters).map((rid) => {
                    const roaster = ROASTERS.find((r) => r.id === rid);
                    if (!roaster) return null;
                    return (
                      <div key={rid}>
                        <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 3 }}>
                          {roaster.emoji} {roaster.name}
                        </label>
                        <select
                          value={modelAssignments[rid] ?? ""}
                          onChange={(e) => setModel(rid, e.target.value)}
                          className="w-full px-3 py-2 rounded-lg outline-none"
                          style={{
                            background: "var(--bg)",
                            border: "1px solid var(--border)",
                            color: "var(--text)",
                            fontSize: 12,
                          }}
                        >
                          <option value="">Default (first available)</option>
                          {modelOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {providers.length === 0 && (
              <div
                className="rounded-xl p-4 text-center"
                style={{ background: "#fffbeb", border: "1px solid #fde68a" }}
              >
                <p style={{ fontSize: 13, color: "#92400e", fontWeight: 500 }}>
                  No providers configured
                </p>
                <p style={{ fontSize: 12, color: "#b45309", marginTop: 4 }}>
                  Add a provider in{" "}
                  <a href="/settings" style={{ textDecoration: "underline" }}>
                    Settings
                  </a>{" "}
                  to run real roasts
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
