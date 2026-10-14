import { gzipSync } from "node:zlib";
import { readdir, readFile } from "node:fs/promises";
import { build, type InlineConfig } from "vite";

type AttributionCategory =
  | "generated-catalog"
  | "formal-syntax-selection"
  | "analysis-v2"
  | "app-shell"
  | "product-runtime"
  | "other-runtime"
  | "bootstrap-shared";

const CATEGORY_ORDER: readonly AttributionCategory[] = [
  "generated-catalog",
  "formal-syntax-selection",
  "analysis-v2",
  "app-shell",
  "product-runtime",
  "other-runtime",
  "bootstrap-shared",
];

function normalize(id: string): string {
  return id.replaceAll("\\", "/");
}

function categoryForModule(id: string): AttributionCategory | undefined {
  const path = normalize(id);
  if (!path.includes("/src/")) return undefined;
  if (path.endsWith("/src/app/generated/catalog.ts")) return "generated-catalog";
  if (path.includes("/src/app/analysis-v2")) return "analysis-v2";
  if (
    path.includes("/src/syntax/")
    || path.includes("/src/curriculum/")
    || path.includes("/src/compatibility/")
  ) return "formal-syntax-selection";
  if (path.includes("/src/app/")) return "app-shell";
  if (
    path.includes("/src/product/")
    || path.includes("/src/practice/")
    || path.includes("/src/measurement-v2/")
    || path.includes("/src/progress-history/")
    || path.includes("/src/diagnostics/")
    || path.includes("/src/commonness/")
    || path.includes("/src/scheme/")
    || path.includes("/src/core/")
  ) return "product-runtime";
  return "other-runtime";
}

function kilobytes(bytes: number): string {
  return (bytes / 1024).toFixed(1) + " kB";
}

async function collect(directory: URL, prefix = ""): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isDirectory()) {
      found.push(...await collect(new URL(entry.name + "/", directory), prefix + entry.name + "/"));
    } else {
      found.push(prefix + entry.name);
    }
  }
  return found;
}

async function productionJsSize(): Promise<{ raw: number; gzip: number }> {
  const distUrl = new URL("../dist/", import.meta.url);
  const names = await collect(distUrl);
  let raw = 0;
  let gzip = 0;
  for (const name of names.filter((name) => name.endsWith(".js"))) {
    const contents = await readFile(new URL(name, distUrl));
    raw += contents.byteLength;
    gzip += gzipSync(contents).byteLength;
  }
  return { raw, gzip };
}

function extractLiteral(source: string, name: string): string {
  const escaped = name.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp("^const " + escaped + "[^=]* = (.*);$", "m"));
  if (match?.[1] === undefined) throw new Error("generated catalog literal not found: " + name);
  return match[1];
}

function payloadSize(source: string, names: readonly string[]): { raw: number; gzip: number } {
  const payload = names.map((name) => extractLiteral(source, name)).join("\n");
  return {
    raw: Buffer.byteLength(payload),
    gzip: gzipSync(payload).byteLength,
  };
}

const normal = await productionJsSize();

const config: InlineConfig = {
  logLevel: "silent",
  build: {
    write: false,
  },
};

const built = await build(config);
const outputs = Array.isArray(built) ? built : [built];
const categoryRendered = new Map<AttributionCategory, number>();

for (const output of outputs) {
  if (!("output" in output)) continue;
  for (const item of output.output) {
    if (item.type !== "chunk") continue;
    for (const [id, module] of Object.entries(item.modules)) {
      const category = categoryForModule(id) ?? "bootstrap-shared";
      categoryRendered.set(
        category,
        (categoryRendered.get(category) ?? 0) + module.renderedLength,
      );
    }
  }
}

const renderedTotal = [...categoryRendered.values()].reduce((sum, bytes) => sum + bytes, 0);

const generatedSource = await readFile(
  new URL("../src/app/generated/catalog.ts", import.meta.url),
  "utf8",
);
const practicePayload = payloadSize(generatedSource, ["ENCODED_PRACTICE"]);
const syntaxPayload = payloadSize(generatedSource, [
  "DEPENDENCY_RELATION_KEYS",
  "SURFACE_POSITION_KEYS",
  "MORPHOLOGICAL_FEATURE_KEYS",
  "OCCURRENCE_CAPABILITY_KEYS",
  "ENCODED_SYNTAX_PROFILES",
]);

console.log("bundle attribution");
console.log("normal production JS: " + kilobytes(normal.gzip) + " gzip / " + kilobytes(normal.raw) + " raw");
console.log("");
console.log("Rollup rendered module ownership (use shares; final minifier/compression happen later)");
for (const category of CATEGORY_ORDER) {
  const bytes = categoryRendered.get(category);
  if (bytes === undefined) continue;
  const share = renderedTotal === 0 ? 0 : (bytes / renderedTotal) * 100;
  console.log(
    "  " + category.padEnd(24)
    + kilobytes(bytes).padStart(10) + " rendered  "
    + share.toFixed(1).padStart(5) + "%",
  );
}
console.log(
  "  " + "rendered-total".padEnd(24)
  + kilobytes(renderedTotal).padStart(10) + " rendered",
);
console.log("");
console.log("generated catalog literal payloads (isolated gzip)");
console.log(
  "  " + "practice entries".padEnd(24)
  + kilobytes(practicePayload.gzip).padStart(10) + " gzip / "
  + kilobytes(practicePayload.raw).padStart(10) + " raw",
);
console.log(
  "  " + "syntax profiles + keys".padEnd(24)
  + kilobytes(syntaxPayload.gzip).padStart(10) + " gzip / "
  + kilobytes(syntaxPayload.raw).padStart(10) + " raw",
);
