import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AttestedPolyphoneBank } from "../src/research/attested-sentence-selector.js";
import { validateAttestedPolyphoneBank } from "../src/research/attested-sentence-selector.js";

/**
 * Independently verifies the exact upstream CoNLL-U text/segmentation and
 * Git blob hashes. No GSD Translit value is accepted as an answer label.
 *
 * npx tsx scripts/verify-attested-gsd-source.ts .external/ud-chinese-gsd
 */
const directory = process.argv[2];
if (directory === undefined) throw new Error("pass a checked-out UD_Chinese-GSD directory");
const path = "data/research/attested-polyphones-v1.json";
const bank = JSON.parse(readFileSync(path, "utf8")) as AttestedPolyphoneBank & {
  source: {
    repository: string;
    pinnedCommitSha: string;
    files: Record<"train"|"dev"|"test", { path: string; blobSha: string }>;
  };
};
validateAttestedPolyphoneBank(bank);
if (bank.source.repository !== "UniversalDependencies/UD_Chinese-GSD"
  || !/^[a-f0-9]{40}$/u.test(bank.source.pinnedCommitSha)) {
  throw new Error("source commit provenance missing");
}
const splits = ["train", "dev", "test"] as const;
let checked = 0;
for (const split of splits) {
  const { path: sourceFile, blobSha } = bank.source.files[split];
  const data = readFileSync(join(directory, sourceFile));
  const actualSha = createHash("sha1")
    .update("blob " + data.length + "\0")
    .update(data).digest("hex");
  if (actualSha !== blobSha) {
    throw new Error(`upstream ${split} blob SHA mismatch (expected ${blobSha}, found ${actualSha})`);
  }
  const byId = new Map<string, string>();
  for (const block of data.toString("utf8").split(/\r?\n\r?\n/u)) {
    const id = block.match(/^# sent_id = (.+)$/mu)?.[1];
    if (id === undefined) continue;
    if (byId.has(id)) throw new Error("duplicate upstream sent_id " + id);
    byId.set(id, block);
  }
  for (const item of bank.cases.filter(c => c.ud.split === split)) {
    const block = byId.get(item.ud.sentId);
    if (block === undefined) throw new Error("source sentence not found " + item.ud.sentId);
    const sentence = block.match(/^# text = (.*)$/mu)?.[1];
    if (sentence !== item.sentence) throw new Error("source sentence text drift for " + item.id);
    const matches = block.split(/\r?\n/u)
      .map(line => line.split("\t"))
      .filter(tokens => /^\d+$/u.test(tokens[0] ?? "")
        && tokens.length === 10
        && tokens[1] === item.lexeme
        && tokens[3] === item.ud.sourceTokenUpos);
    if (matches.length !== 1) throw new Error("source lexical token identity not unique " + item.id);
    const misc = matches[0]![9]!;
    const translit = misc.match(/(?:^|\|)Translit=([^|]+)/u)?.[1];
    if (translit !== item.ud.rawTranslitUntrusted) {
      throw new Error("source transliteration drift (never an answer label): " + item.id);
    }
    checked++;
  }
}
if (checked !== bank.cases.length) throw new Error("not all cases verified");
console.log(JSON.stringify({
  pinnedUpstreamCommit: bank.source.pinnedCommitSha,
  sourceFileHashesMatched: splits.length,
  exactCorpusSentencesAndTokenIdentitiesMatched: checked,
  labelProvenance: "MOE dictionary reviewed target only; CoNLL-U Translit remains untrusted",
}, null, 2));
