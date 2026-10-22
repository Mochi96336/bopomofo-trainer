import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import {
  inferExistingReadingFrontier,
  type DiagnosticLexicon,
} from "./audit-attested-gold-blind-reading.js";
import {
  reviewedTargetTokens, validateAttestedBank,
  type ContextBank,
} from "./prototype-attested-reading-selector.js";

/**
 * Compare actual WHOLE-WORD lexical boundaries for 給 without training a
 * same-UPOS model on the already-opened dev diagnostic.
 * MOE guidance is a usage tendency, NOT a categorical standalone-reading law.
 *
 * Source: https://language.moe.gov.tw/001/Upload/Files/wxiao89/a.pdf
 * MOE "國語一字多音審訂表" item 2508, printed p.157 (PDF index 172):
 * "單獨當動詞與口語習用的新生詞，多音ㄍㄟˇ；複合詞多音ㄐㄧˇ。"
 */
export function auditGiveLexicalBoundary(
  bank: ContextBank,
  catalog: DiagnosticLexicon,
) {
  validateAttestedBank(bank);
  const rows = bank.cases
    .filter(row => row.targetCharacter === "給")
    .map(row => {
      const boundary = row.sourceTokenText === "給"
        ? "standalone-token" : "multi-character-token";
      const candidates = inferExistingReadingFrontier({
        word:row.sourceTokenText,sourceUpos:row.sourceTokenUpos,
        targetOffset:row.characterOffsetInToken,
      },catalog);
      // Gold is intentionally consulted ONLY AFTER lexical boundary and
      // existing candidate frontier have been computed.
      const reviewedTokens = reviewedTargetTokens(row.reviewedCharacterZhuyin);
      const containsGold = candidates.distinctTargetPronunciations.some(item =>
        item.targetTokens.length === reviewedTokens.length
        && item.targetTokens.every((t,i)=>t===reviewedTokens[i]));
      return {
        id:row.id,sourceSentId:row.sourceSentId,
        originalWholeWord:row.sourceTokenText,
        sourceUpos:row.sourceTokenUpos,
        lexicalBoundary:boundary,
        reviewedTargetReading:row.reviewedCharacterZhuyin,
        readingSourceUrl:row.readingSourceUrl,
        frontierStatus:candidates.frontierStatus,
        candidateCount:candidates.distinctTargetPronunciations.length,
        goldPresentInFrontier:containsGold,
        selectedReading:null,
        automaticallyDecided:false,
      };
    });
  const standalone = rows.filter(row=>row.lexicalBoundary==="standalone-token");
  const multi = rows.filter(row=>row.lexicalBoundary==="multi-character-token");
  const distinctStandaloneReviewedReadings=[
    ...new Set(standalone.map(row=>row.reviewedTargetReading))].sort();
  return {
    schemaVersion:"attested-give-lexical-boundary-review-v1",
    input:"fixed dev diagnostic with supplied original UD token and UPOS",
    officialGuidanceUrl:"https://language.moe.gov.tw/001/Upload/Files/wxiao89/a.pdf",
    officialGuidanceItem:"2508 給, printed p.157",
    officialGuidanceIsStatisticalNotAbsolute:true,
    diagnosticSplitIsNotHeldOut:true,
    sourceTranslitUsedAsGold:false,
    goldUsedToMakeCandidateFrontier:false,
    trainingLabelsProduced:0,
    productionPredictionEnabled:false,
    standaloneCount:standalone.length,
    multiCharacterCount:multi.length,
    distinctStandaloneReviewedReadings,
    evidenceForOpposingStandaloneJi:
      standalone.some(row=>row.reviewedTargetReading==="ㄐㄧˇ"),
    caveat:"Absence among opened dev examples is NOT proof no such natural usage exists",
    rows,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  const source=process.argv[2]??"research/attested-reading-pilot/cases.json";
  const dest=process.argv[3]??"data/generated/attested-give-lexical-boundary-review.json";
  const bank=JSON.parse(readFileSync(source,"utf8")) as ContextBank;
  const result=auditGiveLexicalBoundary(bank,{
    entries:PRACTICE_CATALOG, profiles:SYNTAX_PROFILES,
  });
  mkdirSync(dirname(dest),{recursive:true});
  writeFileSync(dest,JSON.stringify(result,null,2)+"\n","utf8");
  console.log(JSON.stringify({
    standaloneCount:result.standaloneCount,
    multiCharacterCount:result.multiCharacterCount,
    distinctStandaloneReviewedReadings:result.distinctStandaloneReviewedReadings,
    evidenceForOpposingStandaloneJi:result.evidenceForOpposingStandaloneJi,
    rows:result.rows.map(row=>({
      id:row.id,form:row.originalWholeWord,
      boundary:row.lexicalBoundary,
      reviewedReading:row.reviewedTargetReading,
      frontierStatus:row.frontierStatus,
      candidateCount:row.candidateCount,
    })),
    limits:result.caveat,
  },null,2));
}
