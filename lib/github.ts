const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rs", ".go", ".java", ".kt", ".swift",
  ".cpp", ".c", ".cc", ".h", ".hpp", ".cs",
  ".rb", ".php", ".scala", ".clj", ".ex", ".exs",
  ".lua", ".r", ".jl", ".zig",
]);

const MAX_FILES = 20;
const MAX_TOTAL_BYTES = 100_000;

interface TreeEntry {
  path: string;
  type: "blob" | "tree";
  url: string;
  size?: number;
}

export interface FetchedCode {
  code: string;
  filename?: string;
  fileCount?: number;
  truncated?: boolean;
}

function isCodeFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return CODE_EXTENSIONS.has(ext);
}

function parseGithubUrl(url: string): { owner: string; repo: string; filePath?: string; ref?: string } | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.replace(/^\//, "").split("/");
    if (parts.length < 2) return null;
    const [owner, repo] = parts;
    if (parts[2] === "blob" && parts.length >= 5) {
      return { owner, repo, ref: parts[3], filePath: parts.slice(4).join("/") };
    }
    return { owner, repo };
  } catch {
    return null;
  }
}

async function ghFetch(url: string): Promise<Response> {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "roast-my-code/1.0",
  };
  return fetch(url, { headers });
}

export async function fetchFromGithub(githubUrl: string): Promise<FetchedCode> {
  const parsed = parseGithubUrl(githubUrl);
  if (!parsed) throw new Error("Invalid GitHub URL");

  const { owner, repo, filePath, ref } = parsed;

  if (filePath) {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref ?? "HEAD"}/${filePath}`;
    const res = await fetch(rawUrl);
    if (!res.ok) throw new Error(`Failed to fetch file: ${res.statusText}`);
    const code = await res.text();
    return { code, filename: filePath.split("/").pop() };
  }

  const infoRes = await ghFetch(`https://api.github.com/repos/${owner}/${repo}`);
  if (!infoRes.ok) throw new Error(`Repo not found or private: ${infoRes.statusText}`);
  const info = await infoRes.json() as { default_branch: string };
  const branch = info.default_branch ?? "main";

  const treeRes = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
  );
  if (!treeRes.ok) throw new Error(`Failed to fetch file tree: ${treeRes.statusText}`);
  const treeData = await treeRes.json() as { tree: TreeEntry[] };

  const codeFiles = treeData.tree
    .filter((e) => e.type === "blob" && isCodeFile(e.path))
    .sort((a, b) => (a.size ?? 0) - (b.size ?? 0))
    .slice(0, MAX_FILES);

  const parts: string[] = [];
  let totalBytes = 0;

  for (const file of codeFiles) {
    if (totalBytes >= MAX_TOTAL_BYTES) break;
    try {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`;
      const res = await fetch(rawUrl);
      if (!res.ok) continue;
      const text = await res.text();
      const chunk = `// === ${file.path} ===\n${text}\n`;
      totalBytes += chunk.length;
      if (totalBytes > MAX_TOTAL_BYTES) {
        parts.push(`// === ${file.path} === (truncated)\n${text.slice(0, MAX_TOTAL_BYTES - (totalBytes - chunk.length))}\n`);
        break;
      }
      parts.push(chunk);
    } catch {
      // skip unreadable files
    }
  }

  if (parts.length === 0) throw new Error("No readable code files found in repository");

  return {
    code: parts.join("\n"),
    fileCount: parts.length,
    truncated: totalBytes >= MAX_TOTAL_BYTES,
  };
}
