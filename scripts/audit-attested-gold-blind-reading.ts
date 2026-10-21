import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogEntry } from "../src/core/model.js";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { reviewedRoleReadingEligible } from "../src/readings/pronominal-role-license.js";
import { UPOS_VALUES, type RuntimeSyntaxProfile } from "../src/syntax/types.js";
import {
  reviewedTargetTokens, validateAttestedBank, type ContextBank,
} from "./prototype-attested-reading-selector.js";

/**
 * This is intentionally a *gold-blind candidate-set* diagnostic.
 *
 * INPUTS: an original UD lexical token, its UD UPOS, the position of
 * the examined character, active product catalog / syntax profiles,
 * and the existing *shipping* reviewed role gate.
 *
 * NOT INPUTS: MOE gold pronunciation, UD Translit, or the full sentence.
 *
 * The current product does not accept a pre-existing natural sentence
 * and perform sentence-level Chinese G2P. Claiming this is natural-context
 * model accuracy would be misleading. We are measuring exactly how far
 * exact-word + oracle source UPOS can narrow the reading frontier.
 */
export interface BlindLexicalContext {
  readonly word: string;
  readonly sourceUpos: string;
  readonly targetOffset: number;
}
export interface BlindAlternative {
  readonly targetTokens: readonly string[];
  readonly entryIds: readonly string[];
}
export type BlindFrontierStatus =
  | "word-absent"
  | "no-aligned-syllables"
  | "no-compatible-source-upos-profile"
  | "all-filtered-by-shipping-reading-license"
  | "one-pronunciation"
  | "multiple-pronunciations";

export interface BlindInference {
  readonly frontierStatus: BlindFrontierStatus;
  readonly exactWordCatalogEntries: number;
  readonly alignedEntries: number;
  readonly sourceUposCompatibleEntries: number;
  readonly survivingEntryCount: number;
  readonly distinctTargetPronunciations: readonly BlindAlternative[];
}
export interface DiagnosticLexicon {
  readonly entries: readonly CatalogEntry[];
  readonly profiles: readonly RuntimeSyntaxProfile[];
}

export function inferExistingReadingFrontier(
  input: BlindLexicalContext,
  catalog: DiagnosticLexicon,
): BlindInference {
  const sameWord = catalog.entries.filter(x => x.prompt.text === input.word);
  const count = [...input.word].length;
  const aligned = sameWord.filter(entry => entry.syllables.length === count);
  const sourceUposValid = (UPOS_VALUES as readonly string[]).includes(input.sourceUpos);
  const matchingProfileIds = new Map<string, RuntimeSyntaxProfile[]>();
  if (sourceUposValid) {
    for (const profile of catalog.profiles) {
      if (profile.upos !== input.sourceUpos) continue;
      const bucket = matchingProfileIds.get(profile.entryId) ?? [];
      bucket.push(profile);
      matchingProfileIds.set(profile.entryId, bucket);
    }
  }
  const withProfiles = aligned.filter(entry => matchingProfileIds.has(entry.id));
  const licensed = withProfiles.filter(entry =>
    matchingProfileIds.get(entry.id)!.some(profile =>
      reviewedRoleReadingEligible(entry, profile)));
  const alternatives = new Map<string, {tokens: readonly string[]; entries: string[]}>();
  for (const entry of licensed) {
    const tokens = entry.syllables[input.targetOffset]?.tokens;
    if (tokens === undefined) throw new Error("target character offset exceeds reviewed word");
    const key = tokens.join("|");
    const existing = alternatives.get(key);
    if (existing === undefined) {
      alternatives.set(key, {tokens, entries:[entry.id]});
    } else {
      existing.entries.push(entry.id);
    }
  }
  const distinctTargetPronunciations = [...alternatives.values()]
    .map(a=>({targetTokens:a.tokens,entryIds:a.entries.sort()}))
    .sort((a,b)=>a.targetTokens.join("|").localeCompare(b.targetTokens.join("|")));
  let frontierStatus: BlindFrontierStatus;
  if (sameWord.length === 0) frontierStatus = "word-absent";
  else if (aligned.length === 0) frontierStatus = "no-aligned-syllables";
  else if (withProfiles.length === 0) frontierStatus = "no-compatible-source-upos-profile";
  else if (licensed.length === 0) frontierStatus = "all-filtered-by-shipping-reading-license";
  else if (distinctTargetPronunciations.length === 1) frontierStatus = "one-pronunciation";
  else frontierStatus = "multiple-pronunciations";
  return {
    frontierStatus,
    exactWordCatalogEntries:sameWord.length,
    alignedEntries:aligned.length,
    sourceUposCompatibleEntries:withProfiles.length,
    survivingEntryCount:licensed.length,
    distinctTargetPronunciations,
  };
}

export type DiagnosticOutcome =
  | "unique-matches-reviewed-gold"
  | "unique-conflicts-with-reviewed-gold"
  | "ambiguous-includes-reviewed-gold"
  | "ambiguous-excludes-reviewed-gold"
  | "not-decidable-from-catalog-and-source-upos";

export function evaluateBlindReadingDiagnostic(
  bank: ContextBank,
  catalog: DiagnosticLexicon,
) {
  validateAttestedBank(bank);
  const rows = bank.cases.map(row=>{
    // The ground-truth label is deliberately NOT passed to inferExistingReadingFrontier.
    const blind = inferExistingReadingFrontier({
      word:row.sourceTokenText,
      sourceUpos:row.sourceTokenUpos,
      targetOffset:row.characterOffsetInToken,
    },catalog);
    const goldTokens=reviewedTargetTokens(row.reviewedCharacterZhuyin);
    const matchesGold=blind.distinctTargetPronunciations.some(x=>
      x.targetTokens.length===goldTokens.length
      && x.targetTokens.every((token,i)=>token===goldTokens[i]));
    const outcome: DiagnosticOutcome =
      blind.frontierStatus === "one-pronunciation"
        ? matchesGold ? "unique-matches-reviewed-gold" : "unique-conflicts-with-reviewed-gold"
      : blind.frontierStatus === "multiple-pronunciations"
        ? matchesGold ? "ambiguous-includes-reviewed-gold" : "ambiguous-excludes-reviewed-gold"
      : "not-decidable-from-catalog-and-source-upos";
    return {
      id:row.id,sourceSentId:row.sourceSentId,
      sourceWord:row.sourceTokenText,sourceUpos:row.sourceTokenUpos,
      reviewedTargetReading:row.reviewedCharacterZhuyin,
      outcome,...blind,
    };
  });
  const statusCounts=Object.fromEntries([...new Set(rows.map(x=>x.outcome))].sort()
    .map(k=>[k,rows.filter(x=>x.outcome===k).length]));
  return {
    schemaVersion:"attested-gold-blind-word-and-oracle-upos-v1",
    question:"Does shipping catalog + reviewed role gate uniquely resolve a UD-attested target reading when given the true UD token form and UPOS?",
    usesGoldOnlyAfterPrediction:true,
    goldUsedToFilterCandidates:false,
    note:"The UD UPOS is oracle corpus metadata, NOT the product's own automatic POS prediction.",
    sampleCount:rows.length,sourceCorpusBlob:bank.source.blobSha,
    statusCounts,rows,
    strictBoundary:[
      "This does not evaluate full natural-sentence context: current product only generates new sentences.",
      "Uniqueness from oracle UPOS is a conditional candidate-set result, not end-to-end G2P accuracy.",
      "A word with multiple remaining pronunciations is UNKNOWN, never silently counted correct.",
      "No learner error evidence, UD Translit, or reviewed pronunciation enters the candidate selection.",
      "Source UD annotations may be wrong; the audit follows them as an oracle diagnostic only.",
    ],
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const input=process.argv[2]??"research/attested-reading-pilot/cases.json";
  const output=process.argv[3]??"data/generated/attested-gold-blind-diagnostic.json";
  const bank=JSON.parse(readFileSync(input,"utf8")) as ContextBank;
  const report=evaluateBlindReadingDiagnostic(bank,{
    entries:PRACTICE_CATALOG,profiles:SYNTAX_PROFILES,
  });
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(report,null,2)+"\n","utf8");
  console.log(JSON.stringify({sampleCount:report.sampleCount,
    statusCounts:report.statusCounts,
    ambiguous:report.rows.filter(r=>r.frontierStatus==="multiple-pronunciations")
      .map(r=>({id:r.id,word:r.sourceWord,upos:r.sourceUpos,reading:r.reviewedTargetReading,
        surviving:r.distinctTargetPronunciations.map(a=>a.targetTokens.join("-"))})),
  },null,2));
}
