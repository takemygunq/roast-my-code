@AGENTS.md

# Roast My Code

Local AI code-roasting app. Multiple AI judges with distinct personalities simultaneously critique submitted code.

## Stack
- Next.js 16 (App Router), TypeScript strict, Tailwind v4
- better-sqlite3 + drizzle-orm (SQLite at `data/roast.db`)
- AES-256-GCM encryption for API keys (`data/secret.key`)
- SSE streaming for live roast results
- Provider system: Anthropic, OpenAI, Gemini, OpenRouter, Ollama, CLI bridges

## Dev
```
npm install
npm run dev   # http://localhost:3000
```

## Key files
- `lib/roasters.ts` — 6 roaster personalities + JSON response schema
- `lib/providers/` — multi-provider abstraction (copied from Verdict)
- `app/api/roast/route.ts` — POST creates roast, GET streams SSE
- `app/api/providers/[id]/route.ts` — handles check + models sub-actions via pathname
- `data/` — gitignored; DB + encryption key live here
