import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface AttestedContextCase {
  readonly id: string;
  readonly sourceSentId: string;
  readonly sourceText: string;
  readonly sourceTokenText: string;
  readonly sourceTokenId: number;
  readonly sourceTokenUpos: string;
  readonly sourceTokenTranslit: string;
  readonly sourceTokenStart: number;
  readonly targetCharacter: string;
  readonly characterOffsetInToken: number;
  readonly reviewedCharacterZhuyin: string;
  readonly reviewedFullWordPinyin: string;
  readonly readingSourceUrl: string;
  readonly labelStatus: string;
}
export interface ContextBank {
  readonly schemaVersion: string;
  readonly source: {
    readonly repository: string;
    readonly path: string;
    readonly blobSha: string;
    readonly license: string;
  };
  readonly cases: readonly AttestedContextCase[];
}
export type WeakToken = "tone:4" | "tone:3" | "zhuyin:ㄗ";
export const TARGETS: readonly WeakToken[] = ["tone:4","tone:3","zhuyin:ㄗ"];

/** Convert only the *reviewed target character*, never UD's untrusted Translit. */
export function reviewedTargetTokens(zhuyin: string): readonly string[] {
  const phonemes = [...zhuyin].filter(c => /[\u3105-\u3129]/u.test(c))
    .map(c => "zhuyin:" + c);
  const toneMarks: Readonly<Record<string, string>> = {
    "ˊ":"tone:2","ˇ":"tone:3","ˋ":"tone:4","˙":"tone:5",
  };
  const marks = [...zhuyin].filter(c => c in toneMarks);
  if (!phonemes.length || marks.length > 1
    || !/^[\u3105-\u3129]+[ˊˇˋ˙]?$/u.test(zhuyin)) {
    throw new Error("unsupported single-syllable reviewed Zhuyin: " + zhuyin);
  }
  return [...phonemes, marks.length ? toneMarks[marks[0]!]! : "tone:1"];
}

export function validateAttestedBank(bank: ContextBank): void {
  if (bank.schemaVersion !== "attested-context-reading-pilot-v1"
    || bank.source.repository !== "UniversalDependencies/UD_Chinese-GSD"
    || bank.source.path !== "zh_gsd-ud-dev.conllu"
    || !/^[0-9a-f]{40}$/u.test(bank.source.blobSha)
    || bank.source.license !== "CC BY-SA 4.0"
    || bank.cases.length < 12) {
    throw new Error("not the pinned attested-context pilot dataset");
  }
  const ids = new Set<string>();
  for (const row of bank.cases) {
    if (ids.has(row.id)) throw new Error("duplicate review id: " + row.id);
    ids.add(row.id);
    if (row.labelStatus !== "moe-word-or-sense-reviewed"
      || !row.readingSourceUrl.startsWith("https://dict.revised.moe.edu.tw/dictView.jsp?ID=")
      || !row.sourceSentId.startsWith("dev-s")
      || !Number.isSafeInteger(row.sourceTokenId) || row.sourceTokenId < 1
      || row.sourceTokenStart < 0
      || row.sourceText.slice(row.sourceTokenStart,
        row.sourceTokenStart + row.sourceTokenText.length) !== row.sourceTokenText
      || [...row.sourceTokenText][row.characterOffsetInToken] !== row.targetCharacter) {
      throw new Error("unverified or misaligned source/reading: " + row.id);
    }
    reviewedTargetTokens(row.reviewedCharacterZhuyin);
  }
}

/**
 * Small independent A/B: fixed source sentences + already-validated target
 * reading. Changing learner evidence only changes *probability of a case*.
 * It cannot edit a case's word, reading, or source.
 *
 * This is deliberately NOT the shipping frequency-first selector, a full
 * Chinese G2P system, or a learning-effect measurement.
 */
export function weightedAttestedProbability(
  bank: ContextBank, token: WeakToken | null, errorRate = 0.75,
): readonly number[] {
  if (!Number.isFinite(errorRate) || errorRate < 0 || errorRate > 1) {
    throw new Error("errorRate must be in [0,1]");
  }
  const weights = bank.cases.map(row =>
    token !== null && reviewedTargetTokens(row.reviewedCharacterZhuyin).includes(token)
      ? 1 + Math.min(0.45, 0.6 * errorRate)
      : 1
  );
  const sum = weights.reduce((a,b)=>a+b,0);
  return weights.map(w=>w/sum);
}
export function xorshift32(seed: number): number {
  // A strong 32-bit avalanche is required here: adjacent seeds must not
  // land in a narrow RNG interval or some Zhuyin cohorts get zero hits.
  // Deterministic integer hash, not a cryptographic or production RNG.
  let x = seed >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 0x1_0000_0000;
}
export function selectAttestedIndex(probabilities: readonly number[], seed: number): number {
  const u = xorshift32(seed);
  let cumulative=0;
  for (let i=0;i<probabilities.length;i++) {
    cumulative+=probabilities[i]!;
    if(u<cumulative)return i;
  }
  return probabilities.length-1;
}
export function runAttestedAB(bank: ContextBank, samples=8192) {
  validateAttestedBank(bank);
  if (!Number.isSafeInteger(samples) || samples<256 || samples>131072) {
    throw new Error("samples must be 256..131072");
  }
  const groups = TARGETS.map(token=>{
    const baseline=weightedAttestedProbability(bank,null);
    const boosted=weightedAttestedProbability(bank,token);
    const has = bank.cases.map(row=>
      reviewedTargetTokens(row.reviewedCharacterZhuyin).includes(token));
    let b=0,w=0,changed=0;
    for(let i=0;i<samples;i++){
      const old=selectAttestedIndex(baseline,i+1);
      const now=selectAttestedIndex(boosted,i+1);
      b+=Number(has[old]); w+=Number(has[now]);
      changed+=Number(old!==now);
    }
    const exactBaseline=baseline.reduce((n,p,i)=>n+p*Number(has[i]),0);
    const exactBoosted=boosted.reduce((n,p,i)=>n+p*Number(has[i]),0);
    if(exactBoosted<=exactBaseline)throw new Error("expected target probability did not improve");
    return {
      targetToken:token,eligibleCases:has.filter(Boolean).length,
      baselineTargetProbability:exactBaseline,
      boostedTargetProbability:exactBoosted,
      baselineTargetSelections:b,boostedTargetSelections:w,
      pairedSelectionChanges:changed,samples,
    };
  });
  const rawTranslitConflicts=bank.cases.filter(row=>
    row.sourceTokenTranslit.normalize("NFC").toLowerCase()
      !== row.reviewedFullWordPinyin.normalize("NFC").toLowerCase())
    .map(row=>({id:row.id,word:row.sourceTokenText,
      ud:row.sourceTokenTranslit,reviewed:row.reviewedFullWordPinyin}));
  return {
    schemaVersion:"attested-reading-weight-only-ab-v1",
    purpose:"Independent read-only sentence selector. Reading determined from MOE labels first; weakness only weights selection.",
    cohortType:"synthetic 12 mistakes in 16 attempts for one target; no user histories",
    datasetCases:bank.cases.length,samplesPerCohort:samples,
    perWeakToken:groups,
    sourceTranslitDisagreements:rawTranslitConflicts,
    sourceTranslitDisagreementCount:rawTranslitConflicts.length,
    sourceTranslitIsNeverUsedAsAnswer:true,
    labelScope:"one target character within an attested word; NOT full sentence phonetic gold",
    limitations:[
      "Only the reviewed target character is labeled; other characters are not reviewed.",
      "A UD token's Pinyin mismatch may concern another syllable, not necessarily the target.",
      "This illustrative probability prototype is not production policy or observed human effectiveness.",
      "Dictionary agreement does not independently prove full sentence naturalness or correct UD syntax.",
      "Selected full sentences can be lengthy and are not production-ready exercises.",
    ],
  };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const input=process.argv[2]??"research/attested-reading-pilot/cases.json";
  const output=process.argv[3]??"data/generated/attested-reading-weight-only-ab.json";
  const bank=JSON.parse(readFileSync(input,"utf8")) as ContextBank;
  const report=runAttestedAB(bank);
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(report,null,2)+"\n","utf8");
  console.log(JSON.stringify({
    output,cases:report.datasetCases,translitDisagreements:report.sourceTranslitDisagreementCount,
    results:report.perWeakToken,
  },null,2));
}
