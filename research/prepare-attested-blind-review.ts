import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AttestedTarget } from "./attested-target-selector.js";
import { validateAttestedTargetRows } from "./attested-target-selector.js";

/** Produce an INDEPENDENT first-pass reading packet.
 * Deliberately withholds gold Zhuyin, UD's unreliable Translit and the
 * already-selected dictionary URL. A second reviewer can annotate without
 * seeing the existing target answer, then adjudicate separately.
 */
export function blindReadingReviewCsv(cases:readonly AttestedTarget[]):string {
  validateAttestedTargetRows(cases);
  const columns=[
    "case_id","ud_sentence_id","source_sentence","source_word",
    "target_character","character_index_in_word","corpus_url",
    "reviewer_reading","reviewer_confidence","reviewer_context_reason",
  ] as const;
  const cell=(x:string|number)=>'"'+String(x).replaceAll('"','""')+'"';
  const lines=[
    columns.map(cell).join(","),
    ...cases.map(c=>[
      c.id,c.origin.sourceSentenceId,c.origin.sourceSentence,c.target.writtenWord,
      c.target.character,c.target.characterOffset,c.origin.sourceUrl,
      "","","",
    ].map(cell).join(",")),
  ];
  return lines.join("\n")+"\n";
}

if(process.argv[1]?.endsWith("prepare-attested-blind-review.ts")){
  const path=process.argv[2]??"research/data/attested-polyphonic-target-pilot.json";
  const output=process.argv[3]??"data/generated/attested-polyphonic-blind-review.csv";
  const data=JSON.parse(readFileSync(path,"utf8")) as {cases:AttestedTarget[]};
  const csv=blindReadingReviewCsv(data.cases);
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,csv,"utf8");
  console.log(JSON.stringify({
    output,rows:data.cases.length,
    visibility:"Gold Zhuyin, UD Translit and dictionary answers withheld. Reviewers supply their own readings; NOT independently reviewed yet.",
  }));
}
