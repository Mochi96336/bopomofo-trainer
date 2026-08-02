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
 *
 * Three gates, because a per-kind limit alone is not one. An asset kind with no
 * budget used to print "no budget" and pass, so the first `.json`, `.wasm` or
 * `.woff2` the build emitted could weigh megabytes and stay green -- the gate
 * would hold precisely until something new arrived, which is the only time it
 * was needed. So: every kind must be budgeted or explicitly waived, and the
 * total is budgeted too, which catches growth spread thinly across kinds that
 * are each individually within their limit.
 */

const BUDGET_PATH = "bundle-budget.json";

interface Budget {
  readonly gzipBytes: Readonly<Record<string, number>>;
  readonly totalGzipBytes: number;
  /** Kinds knowingly left unbudgeted, each with the reason. */
  readonly unbudgeted?: Readonly<Record<string, string>>;
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
let totalGzip = 0;
let totalRaw = 0;
console.log("bundle size (gzip / raw)");
for (const [kind, total] of [...totals].sort()) {
  totalGzip += total.gzip;
  totalRaw += total.raw;
  const limit = budget.gzipBytes[kind];
  const waiver = budget.unbudgeted?.[kind];
  const headroom = limit !== undefined
    ? `${((total.gzip / limit) * 100).toFixed(1)}% of ${kilobytes(limit)}`
    : waiver !== undefined
      ? `unbudgeted: ${waiver}`
      : "UNBUDGETED";
  console.log(`  ${kind.padEnd(5)} ${kilobytes(total.gzip).padStart(10)} / ${kilobytes(total.raw).padStart(10)}   ${headroom}`);
  if (limit !== undefined && total.gzip > limit) {
    failures.push(
      `${kind} is ${kilobytes(total.gzip)} gzipped, over its ${kilobytes(limit)} budget by ${kilobytes(total.gzip - limit)}`,
    );
  }
  if (limit === undefined && waiver === undefined) {
    failures.push(
      `${kind} is in the build at ${kilobytes(total.gzip)} gzipped with no budget.`
      + ` Give it a limit in ${BUDGET_PATH}, or waive it there with a reason.`,
    );
  }
}

console.log(`  ${"total".padEnd(5)} ${kilobytes(totalGzip).padStart(10)} / ${kilobytes(totalRaw).padStart(10)}`
  + `   ${((totalGzip / budget.totalGzipBytes) * 100).toFixed(1)}% of ${kilobytes(budget.totalGzipBytes)}`);
if (totalGzip > budget.totalGzipBytes) {
  failures.push(
    `the whole bundle is ${kilobytes(totalGzip)} gzipped, over its`
    + ` ${kilobytes(budget.totalGzipBytes)} budget by ${kilobytes(totalGzip - budget.totalGzipBytes)}`,
  );
}

for (const kind of Object.keys(budget.gzipBytes)) {
  if (!totals.has(kind)) console.log(`  ${kind}: budgeted but not built`);
}

if (failures.length > 0) {
  console.error("");
  console.error("bundle size gate failed:");
  for (const failure of failures) console.error(`  ${failure}`);
  // Deliberately not phrased as a bug. Growing the catalog is the plan, and
  // paying for it is a decision -- this asks for the decision to be made and
  // recorded rather than made silently.
  console.error(
    `\nEither reduce what ships, or raise the limit in ${BUDGET_PATH} in the same`
    + " change, so the download cost of an expansion is agreed to rather than absorbed.",
  );
  process.exit(1);
}
