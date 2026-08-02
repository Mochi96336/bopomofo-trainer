import { manifestDigest } from "./catalog-qa-core.js";

export type VerdictColumn = "reading_verdict" | "role_verdict";

export interface VerdictProgress {
  readonly total: number;
  readonly blank: number;
  readonly unsure: number;
  readonly unresolved: number;
  readonly complete: boolean;
}

/** Covers the complete metadata object, apart from the digest field itself. */
export function metadataIntegrityDigest(
  metadata: Readonly<Record<string, unknown>>,
): string {
  const covered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (key !== "integrityDigest") covered[key] = value;
  }
  return manifestDigest(covered);
}

/** A stratum rate is publishable only after every sampled row has a verdict. */
export function verdictProgress(
  records: readonly Readonly<Record<string, string>>[],
  column: VerdictColumn,
): VerdictProgress {
  let blank = 0;
  let unsure = 0;
  for (const record of records) {
    const verdict = (record[column] ?? "").trim();
    if (verdict === "") blank += 1;
    else if (verdict === "unsure") unsure += 1;
  }
  const unresolved = blank + unsure;
  return {
    total: records.length,
    blank,
    unsure,
    unresolved,
    complete: unresolved === 0,
  };
}

/**
 * Keeps the independently valid catalog headline, but withholds complete-case
 * stratum rates until the rows those rates depend on are all resolved.
 */
export function guardStratumOutput(
  output: string,
  progress: Readonly<Record<VerdictColumn, VerdictProgress>>,
): string {
  const guarded: string[] = [];
  let section: VerdictColumn | null = null;
  let skippingStrata = false;

  for (const line of output.split("\n")) {
    if (line.startsWith("## ")) {
      skippingStrata = false;
      section = line === "## reading"
        ? "reading_verdict"
        : line === "## grammar role"
          ? "role_verdict"
          : null;
      guarded.push(line);
      continue;
    }
    if (skippingStrata) continue;
    if (section !== null && line.startsWith("  by stratum (") && !progress[section].complete) {
      const pending = progress[section];
      guarded.push(
        `  by stratum: not reportable -- ${pending.unresolved} of ${pending.total}`
        + ` rows are unresolved (${pending.blank} blank, ${pending.unsure} unsure).`,
      );
      guarded.push(
        "    The catalog headline above remains valid when its base sample is complete;"
        + " localisation waits for every sampled row so difficult rows cannot disappear"
        + " from a level's denominator.",
      );
      skippingStrata = true;
      continue;
    }
    guarded.push(line);
  }

  return guarded.join("\n");
}
