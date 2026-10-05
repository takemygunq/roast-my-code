import path from "node:path";

export function dataDir(): string {
  const override = process.env.ROAST_DATA_DIR;
  if (override) return path.resolve(override);
  return path.join(process.cwd(), "data");
}
