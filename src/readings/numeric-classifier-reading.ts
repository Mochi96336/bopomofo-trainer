import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { StructuralLexicalSlot } from "../syntax/derive.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";

/**
 * Experimental, source-scoped numeric classifier reading license.
 *
 * Never reduce a reading merely because it is the most frequent or its UPOS is NOUN.
 * Restrict ONLY an actual classifier slot immediately preceded by a complete
 * numeric lexical entry. The contextual evidence is independently attested in
 * MOE Revised Mandarin Chinese Dictionary:
 *
 * 句 jù (measure word for expressions): https://dict.revised.moe.edu.tw/dictView.jsp?ID=6055
 * 間 jiān (measure word for buildings): https://dict.revised.moe.edu.tw/dictView.jsp?ID=5765
 * 把 bǎ (measure word): https://dict.revised.moe.edu.tw/dictView.jsp?ID=23
 * 尺 chǐ (measure word, length unit): https://dict.revised.moe.edu.tw/dictView.jsp?ID=8217
 * 曲 qǔ (measure word for melodies): https://dict.revised.moe.edu.tw/dictView.jsp?ID=6661
 * 號 hào (measure word for numbered people): https://dict.revised.moe.edu.tw/dictView.jsp?ID=4827
 *
 * This is not enabled in PRODUCT_READING_POLICY until the full real-catalog
 * A/B and negative-context validation is inspected. Unreviewed contexts abstain.
 */
const NUMERIC_LEXEME = /^[零〇一二三四五六七八九十百千萬億兩0-9０-９]+$/u;

export const REVIEWED_NUMERIC_CLASSIFIER_READINGS: ReadonlyMap<string, string> = new Map([
  ["句", catalogEntryId("句", "ㄐㄩ4")],
  ["間", catalogEntryId("間", "ㄐㄧㄢ1")],
  ["把", catalogEntryId("把", "ㄅㄚ3")],
  ["尺", catalogEntryId("尺", "ㄔ3")],
  ["曲", catalogEntryId("曲", "ㄑㄩ3")],
  ["號", catalogEntryId("號", "ㄏㄠ4")],
]);

export function numericClassifierContext(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
  slot: StructuralLexicalSlot,
  previousEntry: CatalogEntry | null,
): boolean {
  return profile.upos === "NOUN"
    && REVIEWED_NUMERIC_CLASSIFIER_READINGS.has(entry.prompt.text)
    && slot.requiredFunctions.includes("classifier")
    && previousEntry !== null
    && NUMERIC_LEXEME.test(previousEntry.prompt.text);
}

export function reviewedNumericClassifierReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
  slot: StructuralLexicalSlot,
  previousEntry: CatalogEntry | null,
): boolean {
  if (entry.id !== profile.entryId) {
    throw new Error("numeric classifier license must inspect the selected catalog identity");
  }
  if (!numericClassifierContext(entry, profile, slot, previousEntry)) return true;
  return entry.id === REVIEWED_NUMERIC_CLASSIFIER_READINGS.get(entry.prompt.text);
}
