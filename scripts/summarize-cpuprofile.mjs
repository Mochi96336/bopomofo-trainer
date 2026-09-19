import { readFileSync } from "node:fs";
import { basename } from "node:path";

const path = process.argv[2];
if (!path) throw new Error("usage: node scripts/summarize-cpuprofile.mjs <profile>");
const profile = JSON.parse(readFileSync(path, "utf8"));
const byId = new Map(profile.nodes.map((node) => [node.id, node]));
const counts = new Map();
let totalSamples = 0;

for (const id of profile.samples ?? []) {
  const node = byId.get(id);
  if (!node) continue;
  totalSamples += 1;
  const frame = node.callFrame ?? {};
  const url = frame.url ?? "";
  const key = JSON.stringify({
    functionName: frame.functionName || "(anonymous)",
    url,
    line: (frame.lineNumber ?? -1) + 1,
  });
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

const rows = [...counts.entries()].map(([key, samples]) => {
  const frame = JSON.parse(key);
  return {
    functionName: frame.functionName,
    file: frame.url ? basename(frame.url) : "",
    url: frame.url,
    line: frame.line,
    samples,
    pct: totalSamples === 0 ? 0 : Math.round((samples / totalSamples) * 10000) / 100,
  };
}).sort((a, b) => b.samples - a.samples);

const repoRows = rows.filter((row) =>
  row.url.includes("/src/") || row.url.includes("/scripts/")
);

console.log(JSON.stringify({
  totalSamples,
  topRepo: repoRows.slice(0, 40),
  topAll: rows.slice(0, 30),
}, null, 2));
