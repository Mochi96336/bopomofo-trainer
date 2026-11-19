import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRACTICE_CATALOG } from "../src/app/generated/catalog.js";
import { prepareVerifiedGuidedLexemePractice } from "../src/readings/verified-guided-lexeme-practice.js";
import { createInteractionSessionV2, applyInteractionInputV2 } from "../src/practice/interaction-session-v2.js";

const args=process.argv.slice(2);
if(args.length!==4 || args[0]!=="--manifest" || args[2]!=="--output")
  throw new Error("usage: tsx scripts/audit-verified-guided-lexeme-practice.ts --manifest target.json --output report.json");
const raw=JSON.parse(readFileSync(resolve(args[1]!),"utf8")) as unknown;
const compiled=prepareVerifiedGuidedLexemePractice(raw,PRACTICE_CATALOG);
let tokens=0,syllables=0;
const examples:{entryId:string,word:string,syllables:number}[]=[];
for(const entryId of compiled.eligibleEntryIds){
  const exercise=compiled.exerciseFor(entryId,"standard");
  if(exercise.mode!=="guided"||exercise.entries.length!==1||exercise.entries[0]!.id!==entryId)
    throw new Error("not a standalone exact-reading guided exercise");
  let session=createInteractionSessionV2(exercise,0);
  const plan=session.plan;
  if(plan.syllables.length!==exercise.entries[0]!.syllables.length)
    throw new Error("the selected exact reading was not compiled into its syllables");
  syllables+=plan.syllables.length;
  for(const syllable of plan.syllables){
    for(const slot of [...syllable.bodySlots,syllable.toneSlot]){
      tokens++;
      session=applyInteractionInputV2(session,{
        timestampMs:tokens,physicalCode:"audit:key",actualToken:slot.tokenId,
        repeat:false,composing:false,modifierOnly:false,
      });
      if(session.traces.at(-1)?.accepted!==true || session.traces.at(-1)?.entryId!==entryId)
        throw new Error("guided target cannot complete expected keyboard input: "+entryId);
    }
  }
  if(!session.completed)throw new Error("guided target exercise did not complete: "+entryId);
  if(examples.length<15)examples.push({
    entryId,word:exercise.entries[0]!.prompt.text,syllables:plan.syllables.length,
  });
}
const report={
  schemaVersion:"verified-guided-lexeme-real-input-v1",
  eligibleStandaloneGuidedReadings:compiled.eligibleEntryIds.length,
  distinctReadings:compiled.eligibleEntryIds.length,
  compiledSyllables:syllables,
  acceptedKeyEvents:tokens,
  completedExercises:compiled.eligibleEntryIds.length,
  sampleEntries:examples,
  productionPolicyChanged:false,
  note:"No generated sentence, meaning selection, or recall-mode answer. These are fully typed isolated practice lexemes, not a rollout to the UI.",
};
writeFileSync(resolve(args[3]!),JSON.stringify(report,null,2)+"\n","utf8");
console.log("VERIFIED_GUIDED_LEXEME_INPUT_JSON "+JSON.stringify({
  approved:report.eligibleStandaloneGuidedReadings,
  syllables:report.compiledSyllables,acceptedKeyEvents:report.acceptedKeyEvents,
  completedExercises:report.completedExercises,
  productionPolicyChanged:false,
}));
