"use client";

import { useState, useEffect } from "react";
import { PROVIDER_KINDS, type ProviderKind } from "@/lib/providers/types";

const KEYLESS_KINDS: ProviderKind[] = ["demo", "ollama", "claude-cli", "codex-cli", "gemini-cli"];
const CLI_KINDS: ProviderKind[] = ["claude-cli", "codex-cli", "gemini-cli"];

interface ProviderRow {
  id: string;
  kind: string;
  label: string;
  encryptedKey: string;
  baseUrl: string | null;
  models: string;
  createdAt: number;
  updatedAt: number;
}

const KIND_LABELS: Record<ProviderKind, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Google Gemini",
  openrouter: "OpenRouter",
  ollama: "Ollama (local)",
  "claude-cli": "Claude CLI",
  "codex-cli": "Codex CLI",
  "gemini-cli": "Gemini CLI",
  demo: "Demo (no key needed)",
};

export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function loadProviders() {
    try {
      const res = await fetch("/api/providers");
      const data = await res.json();
      setProviders(data.providers ?? []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { loadProviders(); }, []);

  async function deleteProvider(id: string) {
    await fetch(`/api/providers/${id}`, { method: "DELETE" });
    setProviders((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="min-h-full">
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div className="max-w-3xl mx-auto px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="font-bold" style={{ fontSize: 20, color: "var(--text)" }}>
              ⚙️ Settings
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-2)", marginTop: 2 }}>
              Manage AI providers and API keys
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity"
            style={{ background: "var(--accent)" }}
          >
            + Add Provider
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-8 py-6 space-y-6">
        {/* Encryption note */}
        <div
          className="px-4 py-3 rounded-xl flex items-start gap-3"
          style={{ background: "rgba(79,107,255,0.06)", border: "1px solid rgba(79,107,255,0.2)" }}
        >
          <span style={{ fontSize: 16 }}>🔐</span>
          <p style={{ fontSize: 13, color: "var(--text-2)" }}>
            API keys are encrypted with AES-256-GCM and stored locally in{" "}
            <code
              className="px-1 rounded font-mono"
              style={{ background: "rgba(79,107,255,0.12)", fontSize: 12 }}
            >
              data/roast.db
            </code>
            . The encryption key is in{" "}
            <code
              className="px-1 rounded font-mono"
              style={{ background: "rgba(79,107,255,0.12)", fontSize: 12 }}
            >
              data/secret.key
            </code>
            . Never commit the{" "}
            <code
              className="px-1 rounded font-mono"
              style={{ background: "rgba(79,107,255,0.12)", fontSize: 12 }}
            >
              data/
            </code>
            {" "}directory.
          </p>
        </div>

        {/* Provider list */}
        {loading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl animate-pulse-slow"
                style={{ height: 80, background: "var(--surface)", border: "1px solid var(--border)" }}
              />
            ))}
          </div>
        )}

        {!loading && providers.length === 0 && !showAdd && (
          <div
            className="text-center py-12 rounded-2xl"
            style={{ background: "var(--surface)", border: "2px dashed var(--border)" }}
          >
            <p style={{ fontSize: 32, marginBottom: 8 }}>🤖</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
              No providers yet
            </p>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
              Add a provider to start running roasts with real AI models
            </p>
          </div>
        )}

        {!loading && providers.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            onDelete={() => deleteProvider(p.id)}
            onRefresh={loadProviders}
          />
        ))}

        {showAdd && (
          <AddProviderForm
            onClose={() => setShowAdd(false)}
            onAdded={() => {
              setShowAdd(false);
              loadProviders();
            }}
          />
        )}
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  onDelete,
  onRefresh,
}: {
  provider: ProviderRow;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [fetching, setFetching] = useState(false);
  const models: string[] = JSON.parse(provider.models || "[]");

  async function handleCheck() {
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await fetch(`/api/providers/${provider.id}/check`, { method: "POST" });
      const data = await res.json();
      setCheckResult(data);
    } catch (err: any) {
      setCheckResult({ ok: false, error: err.message });
    } finally {
      setChecking(false);
    }
  }

  async function handleFetchModels() {
    setFetching(true);
    try {
      const res = await fetch(`/api/providers/${provider.id}/models`, { method: "POST" });
      if (res.ok) onRefresh();
    } catch {}
    setFetching(false);
  }

  return (
    <div
      className="rounded-2xl"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="px-5 py-4 flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold" style={{ fontSize: 15, color: "var(--text)" }}>
              {provider.label}
            </span>
            <span
              className="px-2 py-0.5 rounded-full"
              style={{ fontSize: 11, background: "rgba(79,107,255,0.1)", color: "var(--accent)" }}
            >
              {KIND_LABELS[provider.kind as ProviderKind] ?? provider.kind}
            </span>
          </div>
          {provider.baseUrl && (
            <p style={{ fontSize: 12, color: "var(--text-2)", fontFamily: "monospace" }}>
              {provider.baseUrl}
            </p>
          )}
          {models.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {models.slice(0, 8).map((m) => (
                <span
                  key={m}
                  className="px-2 py-0.5 rounded font-mono"
                  style={{ fontSize: 11, background: "var(--bg)", color: "var(--text-2)", border: "1px solid var(--border)" }}
                >
                  {m}
                </span>
              ))}
              {models.length > 8 && (
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>+{models.length - 8} more</span>
              )}
            </div>
          )}

          {checkResult && (
            <div
              className="mt-2 px-3 py-2 rounded-lg text-sm"
              style={{
                background: checkResult.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                color: checkResult.ok ? "var(--success)" : "var(--danger)",
              }}
            >
              {checkResult.ok ? "✓ Connection OK" : `✗ ${checkResult.error ?? "Failed"}`}
            </div>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleFetchModels}
            disabled={fetching}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity"
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--text-2)",
              opacity: fetching ? 0.6 : 1,
            }}
          >
            {fetching ? "Fetching…" : "↺ Models"}
          </button>
          <button
            onClick={handleCheck}
            disabled={checking}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity"
            style={{
              background: "rgba(79,107,255,0.08)",
              border: "1px solid rgba(79,107,255,0.2)",
              color: "var(--accent)",
              opacity: checking ? 0.6 : 1,
            }}
          >
            {checking ? "Checking…" : "Test"}
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "var(--danger)",
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function AddProviderForm({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [kind, setKind] = useState<ProviderKind>("anthropic");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const needsKey = !KEYLESS_KINDS.includes(kind);
  const isCli = CLI_KINDS.includes(kind);

  async function handleSave() {
    if (!label.trim()) { setError("Name is required"); return; }
    if (needsKey && !apiKey.trim()) { setError("API key is required for this provider"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, label: label.trim(), apiKey: apiKey.trim(), baseUrl: baseUrl.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      onAdded();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-6 space-y-4"
      style={{ background: "var(--surface)", border: "2px solid var(--accent)", boxShadow: "0 4px 24px rgba(79,107,255,0.12)" }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold" style={{ fontSize: 15, color: "var(--text)" }}>
          Add Provider
        </h3>
        <button onClick={onClose} style={{ color: "var(--text-3)", fontSize: 18, lineHeight: 1 }}>✕</button>
      </div>

      <div>
        <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)" }}>
          Provider Type
        </label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as ProviderKind)}
          className="w-full px-3 py-2.5 rounded-xl outline-none"
          style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 14 }}
        >
          {PROVIDER_KINDS.map((k) => (
            <option key={k} value={k}>{KIND_LABELS[k] ?? k}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)" }}>
          Display Name
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={KIND_LABELS[kind] ?? kind}
          className="w-full px-3 py-2.5 rounded-xl outline-none"
          style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 14 }}
        />
      </div>

      {needsKey && (
        <div>
          <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)" }}>
            API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full px-3 py-2.5 rounded-xl outline-none font-mono"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}
          />
        </div>
      )}

      {(kind === "ollama" || kind === "openrouter" || isCli) && (
        <div>
          <label className="block mb-1.5" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)" }}>
            {isCli ? "CLI Path (optional)" : "Base URL (optional)"}
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={isCli ? "/usr/local/bin/claude" : "http://localhost:11434"}
            className="w-full px-3 py-2.5 rounded-xl outline-none font-mono"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}
          />
        </div>
      )}

      {error && (
        <p style={{ fontSize: 13, color: "var(--danger)" }}>{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl font-semibold text-white transition-opacity"
          style={{ background: "var(--accent)", opacity: saving ? 0.6 : 1, fontSize: 14 }}
        >
          {saving ? "Saving…" : "Save Provider"}
        </button>
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl font-medium transition-colors"
          style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 14 }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
