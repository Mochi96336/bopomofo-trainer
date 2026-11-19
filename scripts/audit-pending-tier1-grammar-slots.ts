import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRACTICE_CATALOG, SYNTAX_PROFILES, COMMONNESS_TIER_THRESHOLDS } from "../src/app/generated/catalog.js";
import { catalogsForCommonnessTiers } from "../src/product/commonness-access.js";
import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";
import { buildLexicalProfileIndex, compatibleProfilesForSlot } from "../src/syntax/realize.js";
import type { StructuralLexicalSlot } from "../src/syntax/derive.js";
import type { Upos } from "../src/syntax/types.js";

/**
 * Read-only grammar-entry inventory for every pending Tier1 polyphone group.
 *
 * This is deliberately NOT a pronunciation license, derivation-reachability
 * proof or selected-exposure measurement. A direct Lexeme constituent may
 * inherit additional requirements or be unreachable from Sentence.
 * Report direct lexical compatibility as a REVIEW QUEUE only.
 */
interface Row {
  readonly word: string;
  readonly upos: Upos;
  readonly status: string;
  readonly readingEntryIds: readonly string[];
}
interface Triage {
  readonly version: string;
  readonly tier1: { readonly scope: string; readonly blockedWordUposGroups: number; readonly rows: readonly Row[] };
}
const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== "--triage" || args[2] !== "--output") {
  throw Error("usage: tsx scripts/audit-pending-tier1-grammar-slots.ts --triage triage.json --output report.json");
}
const triage = JSON.parse(readFileSync(resolve(args[1]!), "utf8")) as Triage;
if (triage.version !== "bulk-syntax-evidence-triage-v1" ||
  triage.tier1.scope !== "tier1" ||
  triage.tier1.blockedWordUposGroups !== 131 ||
  triage.tier1.rows.length !== 131) {
  throw Error("Unexpected Tier1 triage population; refusing to silently change denominator");
}
const pending = triage.tier1.rows.filter(row =>
  !["already-reviewed-role-record", "existing-identity-gated-construction-to-evaluate"].includes(row.status));
if (pending.length !== 116) throw Error("Pending conflict count changed; inspect source triage before continuing");
const keys = new Set<string>();
for (const row of pending) {
  const key = JSON.stringify([row.word, row.upos]);
  if (keys.has(key) || !row.word || row.readingEntryIds.length < 2 ||
    new Set(row.readingEntryIds).size !== row.readingEntryIds.length) {
    throw Error("Duplicate or malformed unresolved reading group");
  }
  keys.add(key);
}
const full = {practice:PRACTICE_CATALOG, syntaxProfiles:SYNTAX_PROFILES};
const tier = catalogsForCommonnessTiers(full, COMMONNESS_TIER_THRESHOLDS, [1]);
const index = buildLexicalProfileIndex(tier.practice, tier.syntaxProfiles);
const directSlots = FORMAL_SYNTAX_RULES.flatMap(rule => rule.constituents
  .filter(c => c.category === "Lexeme" && c.formalLiteral === undefined)
  .map(c => ({ruleId: rule.id, constituent: c})));
const rows = pending.map(row => {
  const declared = directSlots.filter(({constituent:c}) =>
    c.allowedUpos.length === 0 || c.allowedUpos.includes(row.upos));
  const compatible = declared.map(({ruleId,constituent:c}) => {
    const slot:StructuralLexicalSlot = {
      kind: "lexical-slot",
      id: "audit:" + ruleId + ":" + c.key,
      constituentKey: c.key,
      occurrenceIndex: 0,
      allowedUpos: c.allowedUpos,
      requiredFunctions: c.requiredFunctions,
      requiredValencyFrames: c.requiredValencyFrames,
      ...(c.requiredOccurrenceCapabilities === undefined ? {} :
        {requiredOccurrenceCapabilities:c.requiredOccurrenceCapabilities}),
      requiredFeatures: c.requiredFeatures,
    };
    const matched = compatibleProfilesForSlot(slot,index).filter(p => {
      const entry = index.entriesById.get(p.entryId);
      return entry?.prompt.text === row.word && p.upos === row.upos &&
        row.readingEntryIds.includes(p.entryId);
    });
    return {
      ruleId, constituentKey:c.key,
      requiredFunctions:c.requiredFunctions,
      requiredFeatures:c.requiredFeatures,
      matchingReadingEntryIds:[...new Set(matched.map(p => p.entryId))].sort(),
    };
  }).filter(slot=>slot.matchingReadingEntryIds.length>0);
  return {
    word:row.word,upos:row.upos,readingEntryIds:row.readingEntryIds,
    sourceTriageStatus:row.status,
    directCompatibleConstituents:compatible,
    directCompatibleCount:compatible.length,
    directSingleReadingCount:compatible.filter(c=>c.matchingReadingEntryIds.length===1).length,
    directMultipleReadingCount:compatible.filter(c=>c.matchingReadingEntryIds.length>1).length,
    reviewState:compatible.length===0
      ? "no-direct-lexeme-compatibility-observed"
      : "direct-lexeme-candidate-needs-native-reachability-and-independent-reading-gold",
    pronunciationLicensed:false,
  };
}).sort((a,b)=>a.word.localeCompare(b.word,"zh-Hant")||a.upos.localeCompare(b.upos));
const report = {
  schemaVersion:"pending-tier1-direct-grammar-slots-v1",
  policy:"research-only; direct constituents are necessary hints, not proof of Sentence derivation, source-backed pronunciation, or selected output",
  pendingGroups:rows.length,
  groupsWithDirectCompatibleConstituents:rows.filter(r=>r.directCompatibleCount>0).length,
  groupsWithoutDirectCompatibleConstituents:rows.filter(r=>r.directCompatibleCount===0).length,
  groupsWithDirectSingletonCandidates:rows.filter(r=>r.directSingleReadingCount>0).length,
  rows,
  productionPolicyChanged:false,
};
writeFileSync(resolve(args[3]!),JSON.stringify(report,null,2)+"\n","utf8");
console.log("PENDING_TIER1_GRAMMAR_SLOTS_JSON "+JSON.stringify({
  pendingGroups:report.pendingGroups,
  groupsWithDirectCompatibleConstituents:report.groupsWithDirectCompatibleConstituents,
  groupsWithoutDirectCompatibleConstituents:report.groupsWithoutDirectCompatibleConstituents,
  groupsWithDirectSingletonCandidates:report.groupsWithDirectSingletonCandidates,
  productionPolicyChanged:false,
}));
