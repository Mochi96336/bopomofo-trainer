import { manifestDigest } from "./catalog-qa-core.js";

export type VerdictColumn = "reading_verdict" | "role_verdict";

/**
 * The complete review-sheet schema, including the verdict columns whose names
 * give the filled cells their meaning.
 *
 * The row digest covers every fixed cell, but a spreadsheet can also relabel or
 * reorder columns without changing any of those cells. In particular, swapping
 * `reading_verdict` and `role_verdict` would make a valid sheet report each
 * judgement as the other one. Scoring therefore requires this exact sequence.
 */
export const CATALOG_QA_HEADERS = [
  "entry_id",
  "text",
  "reading",
  "selection",
  "floor_for",
  "assigned_profiles",
  "profile_count",
  "readingSupport",
  "heteronym",
  "cedict",
  "commonness",
  "grammarEvidence",
  "predicate",
  "reading_verdict",
  "role_verdict",
  "notes",
] as const;

/** Explains why a parsed sheet header cannot be scored, or returns null. */
export function catalogQaHeaderError(headers: readonly string[]): string | null {
  const duplicate = headers.find((header, index) => headers.indexOf(header) !== index);
  if (duplicate !== undefined) {
    return `column "${duplicate}" appears more than once. Column names must be unique.`;
  }
  if (
    headers.length !== CATALOG_QA_HEADERS.length
    || headers.some((header, index) => header !== CATALOG_QA_HEADERS[index])
  ) {
    return "expected columns in this exact order:"
      + `\n  ${CATALOG_QA_HEADERS.join(",")}`
      + "\nactual:"
      + `\n  ${headers.join(",") || "(none)"}`;
  }
  return null;
}

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
