import { readFileSync, writeFileSync } from "node:fs";
import { isMoeSupplementalRoleMismatch, isMoeSupplementFollowupRoleMismatch, isMoeExtendedRoleMismatch, isMoeQianRoleMismatch } from "../src/readings/moe-supplemental-role-license.js";
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

export const FROZEN_SUPPLEMENT_FOLLOWUP_BAD_SLOTS = [
  { seed: 473, slot: 0, id: "word:為:ㄨㄟ4", upos: "PROPN" },
  { seed: 1354, slot: 3, id: "word:好:ㄏㄠ4", upos: "ADV" },
] as const;

// Frozen from the 98f47ff 4,096-seed report, SHA-256 b81ea9c6…8b0394.
export const FROZEN_EXTENDED_BAD_SLOTS = [
  { seed: 2216, slot: 2, id: "word:食:ㄙ4", upos: "NOUN" },
  { seed: 2377, slot: 0, id: "word:哈:ㄏㄚ3", upos: "PROPN" },
  { seed: 2612, slot: 2, id: "word:大:ㄉㄞ4", upos: "ADV" },
  { seed: 2709, slot: 0, id: "word:任:ㄖㄣ4", upos: "PROPN" },
  { seed: 2710, slot: 0, id: "word:曾:ㄘㄥ2", upos: "PROPN" },
  { seed: 2781, slot: 2, id: "word:處:ㄔㄨ4", upos: "VERB" },
  { seed: 3127, slot: 2, id: "word:合:ㄍㄜ3", upos: "PROPN" },
  { seed: 3159, slot: 3, id: "word:讀:ㄉㄡ4", upos: "VERB" },
  { seed: 3264, slot: 0, id: "word:與:ㄩ4", upos: "ADP" },
  { seed: 3371, slot: 3, id: "word:處:ㄔㄨ4", upos: "VERB" },
  { seed: 3385, slot: 1, id: "word:親:ㄑㄧㄥ4", upos: "VERB" },
  { seed: 3485, slot: 4, id: "word:哈:ㄏㄚ3", upos: "PROPN" },
  { seed: 3571, slot: 2, id: "word:曾:ㄘㄥ2", upos: "PROPN" },
  { seed: 3642, slot: 0, id: "word:與:ㄩ4", upos: "ADP" },
  { seed: 3651, slot: 0, id: "word:與:ㄩ4", upos: "ADP" },
  { seed: 3945, slot: 1, id: "word:洗:ㄒㄧㄢ3", upos: "VERB" },
] as const;

interface Stage {
  beforePolicy: string; afterPolicy: string; schemaVersion: string; sampleCount: number;
  targets: readonly { readonly seed: number; readonly slot: number; readonly id: string; readonly upos: string }[];
  mismatch: (hit: Hit) => boolean;
}

// b6e80fb enlarged-catalog exposure, SHA-256 5c1bd8c8…58beb4.
export const FROZEN_QIAN_BAD_SLOTS = [
  { seed: 2864, slot: 2, id: "word:嵌:ㄎㄢ3", upos: "VERB" },
] as const;
export const FROZEN_QIAN_PRESERVED_SLOTS = [
  { seed: 24, slot: 3, id: "word:嵌:ㄑㄧㄢ1" },
  { seed: 2257, slot: 3, id: "word:嵌:ㄑㄧㄢ1" },
] as const;

/** The three actual 嵌 profiles in this frozen catalog are all VERB. */
function assertQianHitCoverage(exposure: Exposure): void {
  const ids = new Set(["word:嵌:ㄑㄧㄢ1", "word:嵌:ㄑㄧㄢ4", "word:嵌:ㄎㄢ3"]);
  const positions = new Map<string, number>();
  for (const hit of exposure.hits.filter(h => ids.has(h.selectedEntryId))) {
    if (exposure.sentences[hit.seedIndex]?.entryIds[hit.entryIndex] !== hit.selectedEntryId
      || hit.selectedUpos !== "VERB") throw new Error("qian selected hit contradicts the frozen catalog/position");
    const key = hit.seedIndex + "/" + hit.entryIndex;
    positions.set(key, (positions.get(key) ?? 0) + 1);
  }
  for (const sentence of exposure.sentences) {
    for (let slot = 0; slot < sentence.entryIds.length; slot++) {
      if (ids.has(sentence.entryIds[slot]!) && positions.get(sentence.seedIndex + "/" + slot) !== 1) {
        throw new Error("qian selected positions require complete, unique hit coverage");
      }
    }
  }
}

function compareRoleStage(before: Exposure, after: Exposure, stage: Stage) {
  const count = stage.sampleCount;
  if (before.readingEligibilityPolicy !== stage.beforePolicy
    || after.readingEligibilityPolicy !== stage.afterPolicy
    || before.seedNamespace !== after.seedNamespace
    || before.catalogEntryCount !== after.catalogEntryCount
    || before.sampleCount !== count || after.sampleCount !== count
    || before.successfulSentences !== count || after.successfulSentences !== count
    || before.failedSentences !== 0 || after.failedSentences !== 0
    || before.sentences.length !== count || after.sentences.length !== count) {
    throw new Error("supplement comparison requires matching successful " + count + "-seed populations");
  }
  const observed = before.hits.filter(stage.mismatch).map(hit => ({ seed: hit.seedIndex,
    slot: hit.entryIndex, id: hit.selectedEntryId, upos: hit.selectedUpos,
  })).sort((a, b) => a.seed - b.seed || a.slot - b.slot);
  if (JSON.stringify(observed) !== JSON.stringify(stage.targets)) {
    throw new Error("frozen supplement source tuples drifted");
  }
  if (after.hits.some(stage.mismatch)) throw new Error("supplemental reading/role mismatch remains");

  const changes: { seedIndex: number; slot: number; priorId: string; newId: string }[] = [];
  for (let i = 0; i < count; i++) {
    const left = before.sentences[i], right = after.sentences[i];
    if (left?.seedIndex !== i || right?.seedIndex !== i || left.root !== right.root
      || left.entryIds.length !== right.entryIds.length) throw new Error("seed/root/length drift at " + i);
    const changed = left.entryIds.flatMap((id, j) => id === right.entryIds[j] ? [] : [j]);
    const targets = stage.targets.filter(row => row.seed === i);
    if (JSON.stringify(changed) !== JSON.stringify(targets.map(row => row.slot))) {
      throw new Error("change outside frozen supplement slots at " + i);
    }
    if (!targets.length && left.text !== right.text) throw new Error("unrelated text drift at " + i);
    for (const target of targets) {
      if (left.entryIds[target.slot] !== target.id) throw new Error("source selected identity drift");
      changes.push({ seedIndex: i, slot: target.slot, priorId: target.id, newId: right.entryIds[target.slot]! });
    }
  }
  return { schemaVersion: stage.schemaVersion, sampleCount: count,
    incompatibleRoleUsesBefore: observed.length, incompatibleRoleUsesAfter: 0,
    changedSeeds: [...new Set(changes.map(row => row.seedIndex))],
    changedSlotCount: changes.length, changedOutsideReviewedSlots: 0, changes,
    caveat: "Counts concern reviewed reading/role incompatibility, not independently adjudicated whole-sentence pronunciation accuracy." };
}

export function compareMoeRoleSupplement(before: Exposure, after: Exposure) {
  return compareRoleStage(before, after, { beforePolicy: "standard-numeric-fen-trial",
    afterPolicy: "standard-role-supplement-trial", schemaVersion: "moe-role-supplement-paired-diff-v1",
    targets: FROZEN_SUPPLEMENT_BAD_SLOTS, mismatch, sampleCount: 2048 });
}

export function compareMoeRoleSupplementFollowup(before: Exposure, after: Exposure) {
  return compareRoleStage(before, after, { beforePolicy: "standard-role-supplement-trial",
    afterPolicy: "standard-role-supplement-followup-trial", schemaVersion: "moe-role-supplement-followup-paired-diff-v1",
    targets: FROZEN_SUPPLEMENT_FOLLOWUP_BAD_SLOTS, sampleCount: 2048, mismatch: hit => hit.selectedUpos !== null
      && isMoeSupplementFollowupRoleMismatch(hit.selectedEntryId, hit.selectedUpos as Upos) });
}

export function compareMoeExtendedRoles(before: Exposure, after: Exposure) {
  return compareRoleStage(before, after, { beforePolicy: "standard-role-supplement-followup-trial",
    afterPolicy: "standard-role-extended-trial", schemaVersion: "moe-extended-role-paired-diff-v1",
    targets: FROZEN_EXTENDED_BAD_SLOTS, sampleCount: 4096, mismatch: hit => hit.selectedUpos !== null
      && isMoeExtendedRoleMismatch(hit.selectedEntryId, hit.selectedUpos as Upos) });
}

export function compareMoeQianRoles(before: Exposure, after: Exposure) {
  if (before.catalogEntryCount !== 13693 || after.catalogEntryCount !== 13693) {
    throw new Error("qian comparison requires the enlarged 13693-entry catalog");
  }
  assertQianHitCoverage(before);
  assertQianHitCoverage(after);
  for (const target of FROZEN_QIAN_PRESERVED_SLOTS) {
    if (before.sentences[target.seed]?.entryIds[target.slot] !== target.id
      || after.sentences[target.seed]?.entryIds[target.slot] !== target.id) {
      throw new Error("qian source preservation anchors drifted");
    }
  }
  return compareRoleStage(before, after, { beforePolicy: "standard-role-extended-trial",
    afterPolicy: "standard-qian-role-trial", schemaVersion: "moe-qian-role-paired-diff-v1",
    targets: FROZEN_QIAN_BAD_SLOTS, sampleCount: 4096, mismatch: hit => hit.selectedUpos !== null
      && isMoeQianRoleMismatch(hit.selectedEntryId, hit.selectedUpos as Upos) });
}

if (process.argv[1]?.endsWith("compare-moe-role-supplement.ts")) {
  const [before, after, output] = process.argv.slice(2);
  if (!before || !after || !output) throw new Error("usage: compare-moe-role-supplement <before> <after> <output>");
  const left = JSON.parse(readFileSync(before, "utf8")) as Exposure;
  const right = JSON.parse(readFileSync(after, "utf8")) as Exposure;
  const compare = right.readingEligibilityPolicy === "standard-qian-role-trial"
    ? compareMoeQianRoles : right.readingEligibilityPolicy === "standard-role-extended-trial"
    ? compareMoeExtendedRoles : right.readingEligibilityPolicy === "standard-role-supplement-followup-trial"
      ? compareMoeRoleSupplementFollowup : compareMoeRoleSupplement;
  const result = compare(left, right);
  writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}
