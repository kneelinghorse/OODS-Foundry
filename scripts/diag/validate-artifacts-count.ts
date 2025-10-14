import { readdirSync, readFileSync } from "fs";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..", "..");
const repoRoot = path.resolve(appRoot, "..");

function loadEnv(): Record<string, string> {
  const envPath = path.join(repoRoot, ".sprint09.env");
  const contents = readFileSync(envPath, "utf8");
  const entries: Record<string, string> = {};
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, value] = trimmed.split("=", 2);
    if (key) {
      entries[key] = value ?? "";
    }
  }
  return entries;
}

function main(): void {
  const env = loadEnv();
  const artDir = env["ART_DIR"];
  if (!artDir) {
    console.error("ART_DIR missing in .sprint09.env");
    process.exit(1);
    return;
  }

  const absolute = path.resolve(repoRoot, artDir);
  const entries = readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => entry.name);

  const max = Number.parseInt(process.env.ARTIFACT_MAX ?? "10", 10);
  if (entries.length > max) {
    console.error(
      `Artifact limit exceeded: ${entries.length} > ${max} in ${path.relative(
        process.cwd(),
        absolute
      )}.\nReduce by embedding tables into sprint-09-summary.md and removing optional attachments.`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Artifacts OK: ${entries.length}/${max}`);
}

main();
