import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ContextBank } from "./prototype-attested-reading-selector.js";

interface UdToken {
  readonly id: number;
  readonly form: string;
  readonly upos: string;
  readonly head: number;
  readonly deprel: string;
  readonly translit: string | null;
}
interface UdSentence {
  readonly id: string;
  readonly text: string;
  readonly tokens: ReadonlyMap<number, UdToken>;
}
interface EvidenceToken {
  readonly tokenId: number;
  readonly text: string;
  readonly upos: string;
  readonly headTokenId: number;
  readonly deprel: string;
}
export interface SourceEvidenceCase {
  readonly caseId: string;
  readonly sourceSentId: string;
  readonly sourceTokenId: number;
  readonly sourceWord: string;
  readonly sourceUpos: string;
  readonly sourceCorpusBlobSha: string;
  readonly rawUdEvidenceTokens: readonly EvidenceToken[];
}
export interface SourceEvidenceBank {
  readonly cases: readonly SourceEvidenceCase[];
}

function requireMatch(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

export function gitBlobSha(content: string): string {
  const bytes = Buffer.from(content, "utf8");
  const gitObject = Buffer.concat([
    Buffer.from("blob " + bytes.length + "\0", "utf8"),
    bytes,
  ]);
  return createHash("sha1").update(gitObject).digest("hex");
}

export function parseConlluSentences(raw: string): ReadonlyMap<string, UdSentence> {
  const sentences = new Map<string, UdSentence>();
  for (const block of raw.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const lines = block.split("\n");
    const sentId = lines.find(line => line.startsWith("# sent_id = "))?.slice(12);
    if (!sentId) continue;
    const sourceText = lines.find(line => line.startsWith("# text = "))?.slice(9);
    requireMatch(sourceText !== undefined, "UD sentence " + sentId + " lacks # text");
    requireMatch(!sentences.has(sentId), "Duplicate UD sentence " + sentId);
    const tokens = new Map<number, UdToken>();
    for (const line of lines) {
      if (!/^\d+\t/.test(line)) continue; // Ignore CoNLL-U multiword and empty nodes.
      const cols = line.split("\t");
      requireMatch(cols.length === 10, sentId + " has invalid CoNLL-U token columns");
      const id = Number(cols[0]);
      requireMatch(Number.isSafeInteger(id) && id > 0, sentId + " invalid token id");
      requireMatch(!tokens.has(id), sentId + " duplicate token " + id);
      const translit = cols[9].split("|").find(x => x.startsWith("Translit="));
      const head = Number(cols[6]);
      requireMatch(Number.isSafeInteger(head) && head >= 0, sentId + " invalid head for " + id);
      tokens.set(id, {
        id, form: cols[1], upos: cols[3], head, deprel: cols[7],
        translit: translit ? translit.slice("Translit=".length) : null,
      });
    }
    sentences.set(sentId, { id: sentId, text: sourceText, tokens });
  }
  return sentences;
}

export function verifyAttestedSourceEvidence(
  corpus: string, bank: ContextBank, evidence: SourceEvidenceBank,
) {
  requireMatch(bank.source.path === "zh_gsd-ud-dev.conllu", "Unexpected source path");
  const sha = gitBlobSha(corpus);
  requireMatch(sha === bank.source.blobSha,
    "UD corpus Git blob mismatch: actual " + sha + ", pinned " + bank.source.blobSha);
  const sentences = parseConlluSentences(corpus);
  const rowsById = new Map(bank.cases.map(row => [row.id, row]));
  requireMatch(rowsById.size === bank.cases.length, "Duplicate case IDs");
  for (const row of bank.cases) {
    const sentence = sentences.get(row.sourceSentId);
    requireMatch(sentence !== undefined, row.id + ": source sentence not found");
    requireMatch(sentence.text === row.sourceText, row.id + ": source sentence text mismatch");
    requireMatch(row.sourceFile === bank.source.path, row.id + ": source file mismatch");
    const token = sentence.tokens.get(row.sourceTokenId);
    requireMatch(token !== undefined, row.id + ": source token not found");
    requireMatch(token.form === row.sourceTokenText, row.id + ": token form mismatch");
    requireMatch(token.upos === row.sourceTokenUpos, row.id + ": token UPOS mismatch");
    requireMatch(token.translit === row.sourceTokenTranslit,
      row.id + ": original untrusted Translit metadata mismatch");
    requireMatch(row.sourceText.slice(row.sourceTokenStart,
      row.sourceTokenStart + row.sourceTokenText.length) === row.sourceTokenText,
      row.id + ": annotated source-text offset mismatch");
    requireMatch([...row.sourceTokenText][row.characterOffsetInToken] === row.targetCharacter,
      row.id + ": target-character offset mismatch");
    // Gold is intentionally not inspected: the UD source only attests context, not correct reading.
  }
  const checkedEvidence = new Set<string>();
  for (const cue of evidence.cases) {
    requireMatch(!checkedEvidence.has(cue.caseId), "Duplicate dependency cue " + cue.caseId);
    checkedEvidence.add(cue.caseId);
    const row = rowsById.get(cue.caseId);
    requireMatch(row !== undefined, cue.caseId + ": dependency cue has no target row");
    requireMatch(cue.sourceSentId === row.sourceSentId
      && cue.sourceTokenId === row.sourceTokenId
      && cue.sourceWord === row.sourceTokenText
      && cue.sourceUpos === row.sourceTokenUpos
      && cue.sourceCorpusBlobSha === bank.source.blobSha,
      cue.caseId + ": dependency cue identity mismatch");
    const sentence = sentences.get(cue.sourceSentId)!;
    const seen = new Set<number>();
    for (const evidenceToken of cue.rawUdEvidenceTokens) {
      requireMatch(!seen.has(evidenceToken.tokenId),
        cue.caseId + ": duplicate dependency token " + evidenceToken.tokenId);
      seen.add(evidenceToken.tokenId);
      const token = sentence.tokens.get(evidenceToken.tokenId);
      requireMatch(token !== undefined,
        cue.caseId + ": unknown dependency token " + evidenceToken.tokenId);
      requireMatch(token.form === evidenceToken.text
        && token.upos === evidenceToken.upos
        && token.head === evidenceToken.headTokenId
        && token.deprel === evidenceToken.deprel,
        cue.caseId + ": source dependency mismatch for token " + evidenceToken.tokenId);
    }
    requireMatch(seen.has(cue.sourceTokenId), cue.caseId + ": target missing in raw evidence");
  }
  requireMatch(checkedEvidence.size === 3, "Expected exactly three unresolved source cues");
  for (const id of ["gsd-012", "gsd-013", "gsd-015"]) {
    requireMatch(checkedEvidence.has(id), "Missing unresolved cue " + id);
  }
  return {
    corpusBlobSha: sha, corpusSentences: sentences.size,
    attestedTargetsVerified: bank.cases.length,
    rawContextCuesVerified: checkedEvidence.size,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const source = process.argv[2];
  requireMatch(source, "Usage: verify-attested-ud-source.ts <upstream-dev.conllu>");
  const bank = JSON.parse(readFileSync(
    "research/attested-reading-pilot/cases.json", "utf8")) as ContextBank;
  const evidence = JSON.parse(readFileSync(
    "research/attested-reading-pilot/unresolved-context-evidence.json", "utf8")) as SourceEvidenceBank;
  const result = verifyAttestedSourceEvidence(readFileSync(source, "utf8"), bank, evidence);
  console.log(JSON.stringify(result, null, 2));
}
