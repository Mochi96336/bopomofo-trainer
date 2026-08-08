import {
  lexicalConstructionFeatureMatches,
  supportsLexicalConstructionFeature,
} from "./lexical-feature-match.js";
import type {
  ProductionConstituent,
  RuntimeSyntaxProfile,
  SyntaxFeatureName,
  SyntaxFeatureSet,
} from "./types.js";

const EVIDENCE_BACKED_FEATURES = new Set<SyntaxFeatureName>([
  "upos",
  "function",
  "valency",
  "surfacePosition",
  "dependencyRelation",
  "dependencyDirection",
]);

export function unsupportedProfileFeatureNames(
  features: SyntaxFeatureSet,
): readonly SyntaxFeatureName[] {
  return Object.keys(features)
    .filter((feature) => !EVIDENCE_BACKED_FEATURES.has(feature as SyntaxFeatureName))
    .sort() as SyntaxFeatureName[];
}

export function unsupportedLexicalFeatureNames(
  features: SyntaxFeatureSet,
): readonly SyntaxFeatureName[] {
  return Object.entries(features)
    .filter(([rawFeature, value]) => {
      const feature = rawFeature as SyntaxFeatureName;
      return value === undefined
        || (!EVIDENCE_BACKED_FEATURES.has(feature)
          && !supportsLexicalConstructionFeature(feature, value));
    })
    .map(([feature]) => feature as SyntaxFeatureName)
    .sort();
}

function dependencyDirectionMatches(
  profile: RuntimeSyntaxProfile,
  value: string,
): boolean {
  const evidence = profile.dependencyEvidence as RuntimeSyntaxProfile["dependencyEvidence"] & {
    readonly headDirectionCounts?: Readonly<Record<string, number>>;
  };
  return (evidence.headDirectionCounts?.[value] ?? 0) > 0;
}

function featureMatches(
  profile: RuntimeSyntaxProfile,
  text: string | undefined,
  feature: SyntaxFeatureName,
  value: string | number | boolean,
): boolean {
  switch (feature) {
    case "upos":
      return profile.upos === value;
    case "function":
      return typeof value === "string" && profile.functions.includes(value as never);
    case "valency":
      return typeof value === "string" && profile.valencyFrames.includes(value as never);
    case "dependencyRelation":
      return typeof value === "string"
        && (profile.dependencyEvidence.dependencyRelationCounts[value] ?? 0) > 0;
    case "surfacePosition":
      return typeof value === "string"
        && (profile.dependencyEvidence.surfacePositionCounts[value] ?? 0) > 0;
    case "dependencyDirection":
      return typeof value === "string" && dependencyDirectionMatches(profile, value);
    default:
      return text !== undefined
        && lexicalConstructionFeatureMatches(text, profile, feature, value);
  }
}

export function syntaxProfileMatchesRequirements(
  profile: RuntimeSyntaxProfile,
  requirements: Pick<
    ProductionConstituent,
    "allowedUpos" | "requiredFunctions" | "requiredValencyFrames" | "requiredFeatures"
  >,
  text?: string,
): boolean {
  return (requirements.allowedUpos.length === 0
      || requirements.allowedUpos.includes(profile.upos))
    && requirements.requiredFunctions.every((value) => profile.functions.includes(value))
    && (requirements.requiredValencyFrames.length === 0
      || requirements.requiredValencyFrames.some((value) => profile.valencyFrames.includes(value)))
    && Object.entries(requirements.requiredFeatures).every(([feature, value]) =>
      value !== undefined
      && featureMatches(profile, text, feature as SyntaxFeatureName, value)
    );
}
