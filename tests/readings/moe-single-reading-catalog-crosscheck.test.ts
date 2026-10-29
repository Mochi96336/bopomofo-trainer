import { describe,expect,it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import {
  compareSingleReadingCatalog,
  type UniqueMoeRow,
} from "../../scripts/audit-moe-single-reading-conflicts.js";

function entry(text:string,reading:string):CatalogEntry {
  return {
    id:catalogEntryId(text,reading),
    prompt:{text,locale:"zh-TW"},
    syllables:[],
    tags:[],provenanceIds:[],
  };
}
const source=(text:string,reading:string):UniqueMoeRow=>({
  lookupText:text,trainerReading:reading,sourceEntryId:"source:"+text,
});
describe("MOE single-reading identity conflict cross-check",()=>{
  it("detects wrong full-word identities rather than trusting reviewed status",()=>{
    const report=compareSingleReadingCatalog([
      entry("銀行","ㄧㄣ2 ㄒㄧㄥ2"),
      entry("好奇","ㄏㄠ4 ㄑㄧ2"),
    ],[
      source("銀行","ㄧㄣ2 ㄏㄤ2"),
      source("好奇","ㄏㄠ4 ㄑㄧ2"),
    ]);
    expect(report.scopedCatalogTexts).toBe(2);
    expect(report.exactMatches).toBe(1);
    expect(report.potentialConflicts).toEqual([{
      text:"銀行",
      catalogEntryId:catalogEntryId("銀行","ㄧㄣ2 ㄒㄧㄥ2"),
      moeEntryId:catalogEntryId("銀行","ㄧㄣ2 ㄏㄤ2"),
      moeReading:"ㄧㄣ2 ㄏㄤ2",
      sourceEntryId:"source:銀行",
      selectionWeight:null,
    }]);
  });
  it("never flags a catalog heteronym as a word with one permissible reading",()=>{
    const report=compareSingleReadingCatalog([
      entry("東西","ㄉㄨㄥ1 ㄒㄧ1"),
      entry("東西","ㄉㄨㄥ1 ㄒㄧ5"),
    ],[source("東西","ㄉㄨㄥ1 ㄒㄧ1")]);
    expect(report.scopedCatalogTexts).toBe(0);
    expect(report.excludedCatalogMultiReadingTexts).toBe(1);
    expect(report.potentialConflicts).toHaveLength(0);
  });
  it("does not call missing words or unsupported readings confirmed errors",()=>{
    const report=compareSingleReadingCatalog(
      [entry("種植","ㄓㄨㄥ4 ㄓ2")],
      [source("缺席","ㄑㄩㄝ1 ㄒㄧ2")],
    );
    expect(report.notInShippedCatalog).toBe(1);
    expect(report.potentialConflicts).toHaveLength(0);
  });
  it("rejects ambiguous or corrupt official single-reading projection",()=>{
    expect(()=>compareSingleReadingCatalog(
      [entry("銀行","ㄧㄣ2 ㄏㄤ2")],
      [source("銀行","ㄧㄣ2 ㄏㄤ2"),source("銀行","ㄧㄣ2 ㄒㄧㄥ2")],
    )).toThrow(/duplicate headword/);
  });
});
