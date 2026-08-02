import {
  catalogEstimate,
  estimateOver,
  rowsForStratum,
  type CatalogEstimate,
} from "./catalog-qa-core.js";

/**
 * The scored report as a value, and separately as text.
 *
 * Built rather than printed because the rule that decides what may be reported
 * is the whole point of this tool, and a rule that lives in `console.log` calls
 * can only be tested by matching strings against them. An earlier version put
 * the guard in a wrapper that captured the command's stdout and filtered it by
 * prefix; changing "by stratum (uniform..." to "by stratum, uniform..." -- one
 * character of wording, in a file the guard did not import -- disabled it
 * completely, and every test stayed green because they were written against a
 * hand-made copy of the output rather than the output.
 *
 * So the decisions are here, in a structure a test can read, and `render` only
 * chooses words for them.
 */

export interface LevelReport {
  readonly level: string;
  readonly estimate: CatalogEstimate;
}

export interface StratumReport {
  readonly name: string;
  readonly levels: readonly LevelReport[];
}

export interface ColumnReport {
  readonly label: string;
  readonly column: string;
  /** Base rows only. Reportable as soon as the base sample is answered. */
  readonly headline: CatalogEstimate;
  readonly strata: readonly StratumReport[];
}

/**
 * Every level of every stratum, each judged on its own eligible rows.
 *
 * Per level rather than per sheet. The rows that decide whether a level can be
 * reported are the ones that level is counted over -- its base rows plus the
 * ones this stratum's own floor reached for -- so a blank row somewhere else on
 * the sheet has nothing to say about it. Blocking the whole table on any
 * unresolved row anywhere would mean one `unsure` out of 259 withholding all six
 * strata, including levels that are completely answered, in a protocol whose own
 * instructions tell the reviewer to use `unsure` freely.
 *
 * Within a level the rule is the same one the headline uses: blanks mean no
 * rate, `unsure` means a range, fully answered means a point estimate. The
 * denominator is always the level's whole eligible set, so the rows a reviewer
 * found hardest cannot drop out of it.
 */
export function buildColumnReport(
  records: readonly Readonly<Record<string, string>>[],
  label: string,
  column: string,
  stratumNames: readonly string[],
): ColumnReport {
  const strata = stratumNames.map((name) => {
    const eligible = rowsForStratum(records, name);
    const levels = [...new Set(eligible.map((row) => row[name] ?? "?"))]
      .sort()
      .map((level) => ({
        level,
        estimate: estimateOver(eligible.filter((row) => (row[name] ?? "?") === level), column),
      }))
      // A level nothing was drawn for is absent, not unreported.
      .filter(({ estimate }) => estimate.tally.total > 0);
    return { name, levels };
  }).filter((stratum) => stratum.levels.length > 0);

  return { label, column, headline: catalogEstimate(records, column), strata };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function headlineLines(estimate: CatalogEstimate): readonly string[] {
  const { tally } = estimate;
  if (tally.total === 0) return ["  catalog rate: this sheet holds no base rows"];
  if (estimate.kind === "incomplete") {
    return [
      `  catalog rate: not reportable -- ${tally.blank} of ${tally.total} base rows are blank`,
      `    so far ${tally.wrong} wrong, ${tally.ok} ok, ${tally.unsure} unsure.`
      + " Progress, not an estimate: the unanswered rows are the ones review found"
      + " hardest, so a rate over the rest would flatter the catalog.",
    ];
  }
  const [low, high] = estimate.interval;
  if (estimate.kind === "bounded") {
    return [
      `  catalog rate  ${percent(estimate.low)}–${percent(estimate.high)}`
      + `  (${tally.wrong} wrong, ${tally.unsure} unsure, of ${tally.total} uniform-sample rows,`
      + ` 95% CI ${percent(low)}–${percent(high)})`,
      `    a range because the ${tally.unsure} unsure rows could go either way.`
      + " Resolve them to get a point estimate; dropping them would take the"
      + " hardest rows out of the denominator.",
    ];
  }
  return [
    `  catalog rate  ${percent(estimate.rate)}`
    + `  (${tally.wrong}/${tally.total} uniform-sample rows,`
    + ` 95% CI ${percent(low)}–${percent(high)})`,
  ];
}

function levelLine({ level, estimate }: LevelReport): string {
  const { tally } = estimate;
  const name = `      ${level.padEnd(22)}`;
  if (estimate.kind === "incomplete") {
    return `${name} not reportable  (${tally.blank} of ${tally.total} rows blank)`;
  }
  const [low, high] = estimate.interval;
  const bounds = ` CI ${(low * 100).toFixed(0)}–${(high * 100).toFixed(0)}%`;
  if (estimate.kind === "bounded") {
    return `${name} ${percent(estimate.low)}–${percent(estimate.high)}`
      + `  (${tally.wrong} wrong, ${tally.unsure} unsure, of ${tally.total},${bounds})`;
  }
  return `${name} ${percent(estimate.rate).padStart(6)}  (${tally.wrong}/${tally.total},${bounds})`;
}

export function renderColumnReport(report: ColumnReport): string {
  const lines = [`\n## ${report.label}`, ...headlineLines(report.headline)];
  if (report.strata.length > 0) {
    lines.push("  by stratum (uniform within each level):");
    for (const stratum of report.strata) {
      lines.push(`    ${stratum.name}`);
      for (const level of stratum.levels) lines.push(levelLine(level));
    }
  }
  return lines.join("\n");
}
