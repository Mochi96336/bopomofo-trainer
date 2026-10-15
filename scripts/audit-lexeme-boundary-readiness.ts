import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import {
  auditLexemeBoundaryReadiness,
  type CompoundHostEvidence,
  type LexemeBoundarySeed,
} from "../src/readings/lexeme-boundary-readiness.js";

function cli(): { input: string; output: string } {
  let input = "data/generated/polyphonic-context-reviewed-roles.json";
  let output = "data/generated/polyphonic-lexeme-boundary-readiness.json";
  for (let i = 2; i < process.argv.length; i += 2) {
    const flag = process.argv[i];
    const value = process.argv[i + 1];
    if (!value) throw new Error("missing value for " + flag);
    if (flag === "--input") input = value;
    else if (flag === "--output") output = value;
    else throw new Error("unknown flag: " + flag);
  }
  return { input, output };
}

const { input, output } = cli();
const exposure = JSON.parse(await readFile(input, "utf8")) as {
  readingEligibilityPolicy: string;
  sampleCount: number;
  successfulSentences: number;
  sentences: LexemeBoundarySeed[];
};
if (exposure.readingEligibilityPolicy !== "reviewed-roles"
  || exposure.sampleCount !== exposure.sentences.length
  || exposure.successfulSentences !== exposure.sampleCount) {
  throw new Error("expected complete, same-seed reviewed-roles reading exposure");
}
const source = JSON.parse(await readFile(
  "data/readings/moe-online-headword-sense-evidence.json", "utf8",
)) as { entries: CompoundHostEvidence[] };
const result = auditLexemeBoundaryReadiness(
  source.entries, PRACTICE_CATALOG, SYNTAX_PROFILES, exposure.sentences,
);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  output,
  samples: result.sampledSeeds,
  cases: result.cases.map((row) => ({
    caseId: row.caseId,
    hostLexeme: row.hostLexeme,
    readiness: row.readiness,
    atomic: row.sampledAtomicHostOccurrences,
    surfaceOnly: row.sampledSurfaceOnlySentences,
    isolatedTarget: row.sampledIsolatedTargetSentences,
  })),
  warning: "An attested compound is not a license for an isolated character reading.",
}, null, 2));
