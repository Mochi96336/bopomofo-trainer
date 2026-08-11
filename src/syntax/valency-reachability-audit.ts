import {
  VALENCY_FRAMES,
  type ProductionRule,
  type RuntimeSyntaxProfile,
  type ValencyFrame,
} from "./types.js";

export interface ValencyRequirementAuditRow {
  readonly ruleId: string;
  readonly constituentKey: string;
  readonly category: string;
  readonly requiredFrames: readonly ValencyFrame[];
  readonly supportedFrames: readonly ValencyFrame[];
  readonly unsupportedFrames: readonly ValencyFrame[];
  readonly supportEntryCount: number;
}

export interface ValencyReachabilityAudit {
  readonly profileCount: number;
  readonly entryCount: number;
  readonly supportEntryCountByFrame: Readonly<Record<ValencyFrame, number>>;
  readonly zeroSupportFrames: readonly ValencyFrame[];
  readonly requirementSlots: readonly ValencyRequirementAuditRow[];
  readonly zeroSupportSlots: readonly ValencyRequirementAuditRow[];
  readonly mixedSupportSlots: readonly ValencyRequirementAuditRow[];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Audit the evidence boundary between declared grammar valency and packaged
 * lexical profiles.
 *
 * A `zeroSupportSlot` is stronger than a merely unused frame: every valency
 * alternative accepted by that constituent has zero packaged entry support.
 * A `mixedSupportSlot` is still executable, but at least one named alternative
 * contributes no lexical evidence and therefore cannot be the reason the slot
 * succeeds.
 */
export function auditValencyReachability(
  rules: readonly ProductionRule[],
  profiles: readonly RuntimeSyntaxProfile[],
): ValencyReachabilityAudit {
  const entryIds = new Set(profiles.map((profile) => profile.entryId));
  const entriesByFrame = new Map<ValencyFrame, Set<string>>(
    VALENCY_FRAMES.map((frame) => [frame, new Set<string>()]),
  );
  for (const profile of profiles) {
    for (const frame of profile.valencyFrames) {
      entriesByFrame.get(frame)?.add(profile.entryId);
    }
  }

  const supportEntryCountByFrame = Object.fromEntries(
    VALENCY_FRAMES.map((frame) => [frame, entriesByFrame.get(frame)?.size ?? 0]),
  ) as Record<ValencyFrame, number>;

  const requirementSlots = rules.flatMap((rule) =>
    rule.constituents
      .filter((constituent) => constituent.requiredValencyFrames.length > 0)
      .map((constituent): ValencyRequirementAuditRow => {
        const requiredFrames = [...constituent.requiredValencyFrames].sort(compareText);
        const supportedFrames = requiredFrames
          .filter((frame) => supportEntryCountByFrame[frame] > 0);
        const unsupportedFrames = requiredFrames
          .filter((frame) => supportEntryCountByFrame[frame] === 0);
        const supportedEntries = new Set<string>();
        for (const frame of supportedFrames) {
          for (const entryId of entriesByFrame.get(frame) ?? []) supportedEntries.add(entryId);
        }
        return {
          ruleId: rule.id,
          constituentKey: constituent.key,
          category: constituent.category,
          requiredFrames,
          supportedFrames,
          unsupportedFrames,
          supportEntryCount: supportedEntries.size,
        };
      })
  ).sort((left, right) =>
    compareText(left.ruleId, right.ruleId)
      || compareText(left.constituentKey, right.constituentKey)
  );

  return {
    profileCount: profiles.length,
    entryCount: entryIds.size,
    supportEntryCountByFrame,
    zeroSupportFrames: VALENCY_FRAMES
      .filter((frame) => supportEntryCountByFrame[frame] === 0),
    requirementSlots,
    zeroSupportSlots: requirementSlots.filter((slot) => slot.supportedFrames.length === 0),
    mixedSupportSlots: requirementSlots.filter((slot) =>
      slot.supportedFrames.length > 0 && slot.unsupportedFrames.length > 0
    ),
  };
}
