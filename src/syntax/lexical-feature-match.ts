import { catalogEntryId } from "../core/catalog-entry-id.js";
import type {
  RuntimeSyntaxProfile,
  SyntaxFeatureName,
  SyntaxFeatureValue,
} from "./types.js";

const NEGATORS = new Set(["不", "未", "沒", "沒有", "別", "無", "非", "不是"]);
const ASPECT_MARKERS = new Set(["了", "過", "著", "着"]);
const DISPOSAL_MARKERS = new Set(["把", "將"]);
const PASSIVE_MARKERS = new Set(["被"]);
const EXISTENTIAL_PREDICATES = new Set(["有", "存在"]);
const COMPARATIVE_MARKERS = new Set(["比"]);
const REQUEST_MARKERS = new Set(["請", "請問"]);
const POLAR_QUESTION_PARTICLES = new Set(["嗎"]);
const CONSTITUENT_QUESTION_FORMS = new Set([
  "誰", "什麼", "甚麼", "哪", "哪個", "哪些", "哪裡", "哪兒", "何", "何人", "何處", "何時", "幾", "多少",
]);
const ALTERNATIVE_QUESTION_CONNECTORS = new Set(["還是", "或", "或者", "或是"]);
const POTENTIAL_LINKERS = new Set(["得", "不"]);
const DEGREE_COMPLEMENT_MARKERS = new Set(["得"]);
const DE_MARKERS = new Set(["的"]);
const ASPECT_LE_ENTRY_ID = catalogEntryId("了", "ㄌㄜ5");

const COORDINATION_CONNECTORS: Readonly<Record<string, ReadonlySet<string>>> = {
  coordination: new Set(["和", "與", "及", "以及", "並", "並且", "而"]),
  additive: new Set(["而且", "並且", "且", "又"]),
  alternative: new Set(["或", "或者", "或是", "還是"]),
  "cause-result": new Set(["所以", "因此", "因而", "故", "故而"]),
  condition: new Set(["就", "則", "才", "的話"]),
  hypothetical: new Set(["那麼", "就", "則"]),
  concessive: new Set(["也", "仍", "還是"]),
  contrast: new Set(["但", "但是", "可是", "然而", "不過"]),
  purpose: new Set(["以便", "以免", "好讓"]),
  "temporal-sequence": new Set(["然後", "接著", "隨後", "再"]),
};

const LICENSED_FEATURE_VALUES = new Set([
  "polarity:negative",
  "aspect:marked",
  "voice:disposal",
  "voice:passive",
  "clauseType:existential",
  "clauseType:comparative",
  "clauseType:request",
  "clauseType:relative",
  "clauseType:nominalized",
  "questionType:polar",
  "questionType:constituent",
  "questionType:alternative",
  "complementType:directional",
  "complementType:potential",
  "complementType:degree",
  ...Object.keys(COORDINATION_CONNECTORS).map((value) => `coordinationType:${value}`),
]);

function relationSeen(profile: RuntimeSyntaxProfile, ...relations: readonly string[]): boolean {
  return relations.some(
    (relation) => (profile.dependencyEvidence.dependencyRelationCounts[relation] ?? 0) > 0,
  );
}

function featureKey(feature: SyntaxFeatureName, value: SyntaxFeatureValue): string {
  return `${feature}:${String(value)}`;
}

function formMatchesIdentity(entryId: string | undefined, text: string): boolean {
  // Written-form UD profiles are projected to every reading. The aspect 了
  // construction is ㄌㄜ˙; compare against the canonical catalog identity
  // without depending on the serialized ID layout inside the syntax layer.
  if (text === "了") return entryId === ASPECT_LE_ENTRY_ID;
  return true;
}

export function supportsLexicalConstructionFeature(
  feature: SyntaxFeatureName,
  value: SyntaxFeatureValue,
): boolean {
  return LICENSED_FEATURE_VALUES.has(featureKey(feature, value));
}

/** Resolve closed-class construction licensing from exact catalog identity,
 * written form, and compact UD evidence. This is syntax, not semantics. */
export function lexicalConstructionFeatureMatches(
  entryId: string | undefined,
  text: string,
  profile: RuntimeSyntaxProfile,
  feature: SyntaxFeatureName,
  value: SyntaxFeatureValue,
): boolean {
  if (!formMatchesIdentity(entryId, text)) return false;
  switch (featureKey(feature, value)) {
    case "polarity:negative":
      return NEGATORS.has(text)
        && (relationSeen(profile, "advmod", "aux") || profile.upos === "PART");
    case "aspect:marked":
      return ASPECT_MARKERS.has(text) && relationSeen(profile, "aux");
    case "voice:disposal":
      return DISPOSAL_MARKERS.has(text)
        && profile.upos === "ADP"
        && relationSeen(profile, "case");
    case "voice:passive":
      return PASSIVE_MARKERS.has(text)
        && ((profile.upos === "AUX" && relationSeen(profile, "aux:pass"))
          || (profile.upos === "ADP" && relationSeen(profile, "case")));
    case "clauseType:existential":
      return EXISTENTIAL_PREDICATES.has(text) && profile.functions.includes("predicate");
    case "clauseType:comparative":
      return COMPARATIVE_MARKERS.has(text)
        && profile.upos === "ADP"
        && relationSeen(profile, "case");
    case "clauseType:request":
      return REQUEST_MARKERS.has(text);
    case "clauseType:relative":
    case "clauseType:nominalized":
      return DE_MARKERS.has(text) && relationSeen(profile, "mark:rel");
    case "questionType:polar":
      return POLAR_QUESTION_PARTICLES.has(text)
        && profile.upos === "PART"
        && relationSeen(profile, "discourse:sp");
    case "questionType:constituent":
      return CONSTITUENT_QUESTION_FORMS.has(text);
    case "questionType:alternative":
      return ALTERNATIVE_QUESTION_CONNECTORS.has(text);
    case "complementType:directional":
      return relationSeen(profile, "compound:dir");
    case "complementType:potential":
      return POTENTIAL_LINKERS.has(text) && profile.upos === "PART";
    case "complementType:degree":
      return DEGREE_COMPLEMENT_MARKERS.has(text)
        && profile.upos === "PART"
        && relationSeen(profile, "mark:adv", "mark");
    default: {
      if (feature !== "coordinationType" || typeof value !== "string") return false;
      return COORDINATION_CONNECTORS[value]?.has(text) ?? false;
    }
  }
}
