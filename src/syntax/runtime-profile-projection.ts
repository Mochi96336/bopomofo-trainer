import type { CatalogEntry } from "../core/model.js";
import { sha256Canonical } from "../reference/importers/canonical-json.js";
import type { SyntaxRuleIndexStatus } from "./rule-index.js";
import { projectRuntimeMorphologicalFeatureCounts } from "./runtime-morphology.js";
import type { RuntimeSyntaxProfile } from "./types.js";
import type { ActiveCatalogSyntaxProfilesArtifact } from "./runtime-profiles.js";

interface SourceEntry {
  readonly entryId: string;
  readonly text: string;
  readonly status: SyntaxRuleIndexStatus;
  readonly profileIds: readonly string[];
}

/**
 * Preserve observed source profiles before runtime capability sidecars are
 * applied. Source-index reachability is a separate lineage result; prematurely
 * discarding a profile here prevents a later evidenced construction from ever
 * making its entry reachable. Product packaging recomputes legality afterwards.
 */
export function projectCatalogEntryRuntimeProfiles(
  entry: CatalogEntry,
  sourceEntry: SourceEntry | undefined,
  sourceProfiles: ReadonlyMap<string, RuntimeSyntaxProfile>,
): readonly RuntimeSyntaxProfile[] {
  if (sourceEntry === undefined) return [];
  if (sourceEntry.text !== entry.prompt.text) {
    throw new Error("source syntax entry must match the exact written form");
  }
  if (sourceEntry.status === "indexed" && sourceEntry.profileIds.length === 0) {
    throw new Error(`indexed source entry has no syntax profiles: ${entry.prompt.text}`);
  }
  return sourceEntry.profileIds.map(sourceProfileId => {
    const source = sourceProfiles.get(sourceProfileId);
    if (source === undefined || source.entryId !== sourceEntry.entryId) {
      throw new Error(`source rule index references an invalid syntax profile: ${sourceProfileId}`);
    }
    const morphology = projectRuntimeMorphologicalFeatureCounts(
      source.dependencyEvidence.morphologicalFeatureCounts ?? {},
    );
    return {
      id: `runtime-syntax-profile:${sha256Canonical({ sourceProfileId, catalogEntryId: entry.id })}`,
      entryId: entry.id,
      upos: source.upos,
      functions: source.functions,
      valencyFrames: source.valencyFrames,
      dependencyEvidence: {
        dependencyRelationCounts: source.dependencyEvidence.dependencyRelationCounts,
        surfacePositionCounts: source.dependencyEvidence.surfacePositionCounts,
        ...(morphology === undefined ? {} : { morphologicalFeatureCounts: morphology }),
      },
      provenanceIds: source.provenanceIds,
    };
  });
}

/** Preserve compact profile numbers when a catalog update only adds readings. */
export function preserveRuntimeProfileOrder(
  projected: readonly RuntimeSyntaxProfile[],
  previous: ActiveCatalogSyntaxProfilesArtifact,
): readonly RuntimeSyntaxProfile[] {
  const { determinismDigest, ...core } = previous;
  if (previous.schemaVersion !== "formal-syntax-active-catalog-profiles-v1"
    || previous.profileCount !== previous.profiles.length || determinismDigest !== sha256Canonical(core)) {
    throw new Error("profile-order source artifact is stale or invalid");
  }
  const byId = new Map(projected.map(p => [p.id, p]));
  const seen = new Set<string>();
  const syntaxShape = (p: RuntimeSyntaxProfile): unknown => {
    // Presence-only morphology is independently refreshed after projection.
    const { morphologicalFeatureCounts: _morphology, ...dependencyEvidence } = p.dependencyEvidence;
    return { ...p, dependencyEvidence };
  };
  const ordered = previous.profiles.map(old => {
    const next = byId.get(old.id);
    if (seen.has(old.id) || next === undefined
      || sha256Canonical(syntaxShape(old)) !== sha256Canonical(syntaxShape(next))) {
      throw new Error("preserved profile must retain its identity and syntax: " + old.id);
    }
    seen.add(old.id);
    return next;
  });
  if (byId.size !== projected.length) throw new Error("duplicate projected profile identity");
  return [...ordered, ...projected.filter(p => !seen.has(p.id)).sort((a, b) => a.id.localeCompare(b.id))];
}
