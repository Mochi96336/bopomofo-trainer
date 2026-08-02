import { gzipSync } from "node:zlib";
import { readdir, readFile } from "node:fs/promises";

/**
 * Reports what the built site costs to download, and fails when it grows past a
 * committed budget.
 *
 * The catalog is compiled into the bundle, so the download grows with every
 * entry added to it -- and the roadmap is to keep adding entries. Nothing was
 * reporting that. A budget does not make the bundle smaller; it makes each
 * increase a thing somebody decided rather than a thing that happened, and it
 * puts the number in front of whoever is deciding.
 *
 * Gzip is what a browser actually transfers, so that is what is budgeted. Raw
 * bytes are reported too, because that is what has to be parsed once it lands.
 */

const BUDGET_PATH = "bundle-budget.json";

interface Budget {
  readonly gzipBytes: Readonly<Record<string, number>>;
  readonly note?: string;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1);
}

function kilobytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

const budget = JSON.parse(
  await readFile(new URL(`../${BUDGET_PATH}`, import.meta.url), "utf8"),
) as Budget;

const assetsUrl = new URL("../dist/assets/", import.meta.url);
let names: string[];
try {
  names = await readdir(assetsUrl);
} catch {
  console.error("no dist/assets: run `npm run build` before checking the bundle size.");
  process.exit(1);
}

const totals = new Map<string, { raw: number; gzip: number }>();
for (const name of names.sort()) {
  const contents = await readFile(new URL(name, assetsUrl));
  const kind = extensionOf(name);
  const total = totals.get(kind) ?? { raw: 0, gzip: 0 };
  total.raw += contents.byteLength;
  total.gzip += gzipSync(contents).byteLength;
  totals.set(kind, total);
}

const failures: string[] = [];
console.log("bundle size (gzip / raw)");
for (const [kind, total] of [...totals].sort()) {
  const limit = budget.gzipBytes[kind];
  const headroom = limit === undefined
    ? "no budget"
    : `${((total.gzip / limit) * 100).toFixed(1)}% of ${kilobytes(limit)}`;
  console.log(`  ${kind.padEnd(5)} ${kilobytes(total.gzip).padStart(10)} / ${kilobytes(total.raw).padStart(10)}   ${headroom}`);
  if (limit !== undefined && total.gzip > limit) {
    failures.push(
      `${kind} is ${kilobytes(total.gzip)} gzipped, over its ${kilobytes(limit)} budget by ${kilobytes(total.gzip - limit)}`,
    );
  }
}

for (const kind of Object.keys(budget.gzipBytes)) {
  if (!totals.has(kind)) console.log(`  ${kind}: budgeted but not built`);
}

if (failures.length > 0) {
  console.error("");
  for (const failure of failures) console.error(`over budget: ${failure}`);
  // Deliberately not phrased as a bug. Growing the catalog is the plan, and
  // paying for it is a decision -- this asks for the decision to be made and
  // recorded rather than made silently.
  console.error(
    `\nEither reduce what ships, or raise the limit in ${BUDGET_PATH} in the same`
    + " change, so the download cost of an expansion is agreed to rather than absorbed.",
  );
  process.exit(1);
}
