import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile, Upos } from "../syntax/types.js";
import { buildPolyphonicReadingIndex } from "./polyphonic-audit.js";
import { reviewedRoleReadingEligible } from "./pronominal-role-license.js";

/**
 * A syntactic profile is potential lexical evidence, not proof of a
 * contextually correct reading or of reachability in a complete derivation.
 */
export interface PolyphonicIdentityTarget {
  readonly text: string;
  readonly entryId: string;
  readonly baselineOccurrences: number;
  readonly profileCount: number;
  readonly allowedProfileIds: readonly string[];
  readonly allowedUpos: readonly Upos[];
  readonly rejectedProfileCount: number;
  readonly staticStatus: "no-runtime-profile" | "all-profiles-role-rejected" | "has-licensed-profile";
}

export function buildPolyphonicIdentityTargets(
  entries: readonly CatalogEntry[],
  profiles: readonly RuntimeSyntaxProfile[],
  baselineCounts: Readonly<Record<string, number>>,
): readonly PolyphonicIdentityTarget[] {
  const indexed = buildPolyphonicReadingIndex(entries);
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const profilesByEntryId = new Map<string, RuntimeSyntaxProfile[]>();
  for (const profile of profiles) {
    const source = entriesById.get(profile.entryId);
    if (source === undefined) throw new Error("syntax profile references an unknown catalog entry: " + profile.entryId);
    const group = profilesByEntryId.get(profile.entryId) ?? [];
    group.push(profile);
    profilesByEntryId.set(profile.entryId, group);
  }
  const targets: PolyphonicIdentityTarget[] = [];
  for (const [text, entryIds] of indexed) {
    for (const entryId of entryIds) {
      const entry = entriesById.get(entryId);
      if (entry === undefined || entry.prompt.text !== text) {
        throw new Error("polyphonic index contains an inconsistent catalog identity");
      }
      const profileSet = profilesByEntryId.get(entryId) ?? [];
      const allowed = profileSet.filter(profile => reviewedRoleReadingEligible(entry, profile));
      const count = baselineCounts[entryId] ?? 0;
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error("invalid baseline occurrence count for " + entryId);
      }
      targets.push({
        text,
        entryId,
        baselineOccurrences: count,
        profileCount: profileSet.length,
        allowedProfileIds: allowed.map(profile => profile.id).sort(),
        allowedUpos: [...new Set(allowed.map(profile => profile.upos))].sort(),
        rejectedProfileCount: profileSet.length - allowed.length,
        staticStatus: profileSet.length === 0
          ? "no-runtime-profile"
          : allowed.length === 0
            ? "all-profiles-role-rejected"
            : "has-licensed-profile",
      });
    }
  }
  return targets;
}

export interface IdentityProbeOutcome {
  readonly entryId: string;
  readonly attempts: number;
  readonly generationsWithoutCandidate: number;
  readonly selectedExamples: readonly {
    readonly seedIndex: number;
    readonly text: string;
    readonly syntaxRootRuleId: string | null;
    readonly selectedProfileId: string | null;
    readonly selectedUpos: Upos | null;
    readonly previousEntryText: string | null;
    readonly nextEntryText: string | null;
  }[];
}

/** Separate "not sampled" from "not permitted by any runtime profile".
 * A bounded search that misses a target is *never* evidence of impossibility.
 */
export function classifyPolyphonicIdentityCoverage(
  target: PolyphonicIdentityTarget,
  probe: IdentityProbeOutcome | undefined,
): "observed-in-unbiased-sample"
  | "no-runtime-profile"
  | "all-profiles-role-rejected"
  | "observed-only-in-targeted-probe"
  | "not-observed-after-bounded-probes"
  | "not-probed" {
  if (target.baselineOccurrences > 0) return "observed-in-unbiased-sample";
  if (target.staticStatus !== "has-licensed-profile") return target.staticStatus;
  if (probe === undefined) return "not-probed";
  return probe.selectedExamples.length > 0
    ? "observed-only-in-targeted-probe"
    : "not-observed-after-bounded-probes";
}
