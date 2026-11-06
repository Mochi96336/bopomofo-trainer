import { readFileSync, writeFileSync } from "node:fs";
import { isMoeSupplementalRoleMismatch } from "../src/readings/moe-supplemental-role-license.js";
import type { Upos } from "../src/syntax/types.js";

interface Sentence { seedIndex: number; text: string | null; root: string | null; entryIds: string[] }
interface Hit { seedIndex: number; entryIndex: number; selectedEntryId: string; selectedUpos: string | null }
interface Exposure {
  readingEligibilityPolicy: string; seedNamespace: string; catalogEntryCount: number;
  sampleCount: number; successfulSentences: number; failedSentences: number;
  sentences: Sentence[]; hits: Hit[];
}

// Independently frozen from #461's exact-head final numeric-fen population,
// artifact SHA-256 40a54d57…6453652. Indices are zero based.
export const FROZEN_SUPPLEMENT_BAD_SLOTS = [
  { seed: 67, slot: 1, id: "word:將:ㄑㄧㄤ1", upos: "ADV" },
  { seed: 100, slot: 2, id: "word:親:ㄑㄧㄥ4", upos: "ADJ" },
  { seed: 193, slot: 5, id: "word:無:ㄇㄛ2", upos: "VERB" },
  { seed: 303, slot: 4, id: "word:般:ㄅㄛ1", upos: "ADJ" },
  { seed: 418, slot: 1, id: "word:遠:ㄩㄢ4", upos: "ADJ" },
  { seed: 455, slot: 3, id: "word:中:ㄓㄨㄥ4", upos: "PART" },
  { seed: 463, slot: 1, id: "word:彈:ㄉㄢ4", upos: "VERB" },
  { seed: 513, slot: 3, id: "word:足:ㄐㄩ4", upos: "VERB" },
  { seed: 539, slot: 0, id: "word:石:ㄉㄢ4", upos: "PROPN" },
  { seed: 960, slot: 0, id: "word:親:ㄑㄧㄥ4", upos: "ADJ" },
  { seed: 1034, slot: 0, id: "word:賈:ㄍㄨ3", upos: "PROPN" },
  { seed: 1360, slot: 4, id: "word:任:ㄖㄣ2", upos: "VERB" },
  { seed: 1396, slot: 1, id: "word:爲:ㄨㄟ4", upos: "AUX" },
  { seed: 1409, slot: 3, id: "word:中:ㄓㄨㄥ4", upos: "PART" },
  { seed: 1529, slot: 1, id: "word:石:ㄉㄢ4", upos: "PROPN" },
  { seed: 1535, slot: 3, id: "word:相:ㄒㄧㄤ4", upos: "ADV" },
  { seed: 1555, slot: 1, id: "word:於:ㄨ1", upos: "ADP" },
  { seed: 1670, slot: 3, id: "word:只:ㄓ1", upos: "ADV" },
  { seed: 1721, slot: 0, id: "word:若:ㄖㄜ3", upos: "ADP" },
  { seed: 1842, slot: 4, id: "word:石:ㄉㄢ4", upos: "PROPN" },
  { seed: 1850, slot: 4, id: "word:馮:ㄆㄧㄥ2", upos: "PROPN" },
  { seed: 1937, slot: 3, id: "word:合:ㄍㄜ3", upos: "VERB" },
] as const;

const mismatch = (hit: Hit) => hit.selectedUpos !== null
  && isMoeSupplementalRoleMismatch(hit.selectedEntryId, hit.selectedUpos as Upos);

export function compareMoeRoleSupplement(before: Exposure, after: Exposure) {
  if (before.readingEligibilityPolicy !== "standard-numeric-fen-trial"
    || after.readingEligibilityPolicy !== "standard-role-supplement-trial"
    || before.seedNamespace !== after.seedNamespace
    || before.catalogEntryCount !== after.catalogEntryCount
    || before.sampleCount !== 2048 || after.sampleCount !== 2048
    || before.successfulSentences !== 2048 || after.successfulSentences !== 2048
    || before.failedSentences !== 0 || after.failedSentences !== 0
    || before.sentences.length !== 2048 || after.sentences.length !== 2048) {
    throw new Error("supplement comparison requires matching successful 2048-seed populations");
  }
  const observed = before.hits.filter(mismatch).map(hit => ({ seed: hit.seedIndex,
    slot: hit.entryIndex, id: hit.selectedEntryId, upos: hit.selectedUpos,
  })).sort((a, b) => a.seed - b.seed || a.slot - b.slot);
  if (JSON.stringify(observed) !== JSON.stringify(FROZEN_SUPPLEMENT_BAD_SLOTS)) {
    throw new Error("frozen supplement source tuples drifted");
  }
  if (after.hits.some(mismatch)) throw new Error("supplemental reading/role mismatch remains");

  const changes: { seedIndex: number; slot: number; priorId: string; newId: string }[] = [];
  for (let i = 0; i < 2048; i++) {
    const left = before.sentences[i], right = after.sentences[i];
    if (left?.seedIndex !== i || right?.seedIndex !== i || left.root !== right.root
      || left.entryIds.length !== right.entryIds.length) throw new Error("seed/root/length drift at " + i);
    const changed = left.entryIds.flatMap((id, j) => id === right.entryIds[j] ? [] : [j]);
    const targets = FROZEN_SUPPLEMENT_BAD_SLOTS.filter(row => row.seed === i);
    if (JSON.stringify(changed) !== JSON.stringify(targets.map(row => row.slot))) {
      throw new Error("change outside frozen supplement slots at " + i);
    }
    if (!targets.length && left.text !== right.text) throw new Error("unrelated text drift at " + i);
    for (const target of targets) {
      if (left.entryIds[target.slot] !== target.id) throw new Error("source selected identity drift");
      changes.push({ seedIndex: i, slot: target.slot, priorId: target.id, newId: right.entryIds[target.slot]! });
    }
  }
  return { schemaVersion: "moe-role-supplement-paired-diff-v1", sampleCount: 2048,
    incompatibleRoleUsesBefore: observed.length, incompatibleRoleUsesAfter: 0,
    changedSeeds: [...new Set(changes.map(row => row.seedIndex))],
    changedSlotCount: changes.length, changedOutsideReviewedSlots: 0, changes,
    caveat: "Counts concern reviewed reading/role incompatibility, not independently adjudicated whole-sentence pronunciation accuracy." };
}

if (process.argv[1]?.endsWith("compare-moe-role-supplement.ts")) {
  const [before, after, output] = process.argv.slice(2);
  if (!before || !after || !output) throw new Error("usage: compare-moe-role-supplement <before> <after> <output>");
  const result = compareMoeRoleSupplement(JSON.parse(readFileSync(before, "utf8")) as Exposure,
    JSON.parse(readFileSync(after, "utf8")) as Exposure);
  writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}
