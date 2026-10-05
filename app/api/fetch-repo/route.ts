import { NextResponse } from "next/server";
import { fetchFromGithub } from "@/lib/github";
import AdmZip from "adm-zip";

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rs", ".go", ".java", ".kt", ".swift",
  ".cpp", ".c", ".cc", ".h", ".hpp", ".cs",
  ".rb", ".php", ".lua",
]);

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    // ZIP upload
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

      const arrayBuf = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();

      const parts: string[] = [];
      let totalBytes = 0;
      const MAX = 100_000;
      let fileCount = 0;

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const name = entry.entryName;
        const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
        if (!CODE_EXTENSIONS.has(ext)) continue;
        if (fileCount >= 20) break;
        if (totalBytes >= MAX) break;

        const content = entry.getData().toString("utf8");
        const chunk = `// === ${name} ===\n${content}\n`;
        totalBytes += chunk.length;
        if (totalBytes > MAX) {
          parts.push(`// === ${name} === (truncated)\n${content.slice(0, MAX - (totalBytes - chunk.length))}\n`);
          break;
        }
        parts.push(chunk);
        fileCount++;
      }

      if (parts.length === 0) {
        return NextResponse.json({ error: "No code files found in archive" }, { status: 400 });
      }

      return NextResponse.json({
        code: parts.join("\n"),
        fileCount: parts.length,
        filename: file.name,
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // JSON body (GitHub URL)
  try {
    const body = await req.json();
    const { url, type } = body;

    if (type === "github" && url) {
      const result = await fetchFromGithub(url);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
