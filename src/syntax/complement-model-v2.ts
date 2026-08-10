export interface RetiredComplementRuleV2Decision {
  readonly evidenceContract: string;
  readonly replacement: string;
  readonly note: string;
}

/**
 * Complement productions deliberately removed from the executable grammar
 * during the formal-syntax v2 migration. Keeping the decision outside the
 * production inventory preserves provenance without making a retired shape
 * look executable.
 */
export const RETIRED_COMPLEMENT_RULE_V2_DECISIONS = {
  "complement.result": {
    evidenceContract: "resultative-evidence-audit-v1",
    replacement: "compound:vv-or-reviewed-reconstruction:TBD",
    note: "The pinned GSD conversion does not preserve exact compound:vv support; generic compound and compound:ext must not be promoted to resultative evidence.",
  },
} as const satisfies Readonly<Record<string, RetiredComplementRuleV2Decision>>;
