from pathlib import Path

path = Path("src/syntax/sample.ts")
text = path.read_text()

def once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one {label} anchor, found {count}")
    text = text.replace(old, new, 1)

once(
'''function nestedTargetKey(parentRuleId: string, constituentKey: string): string {
  return `${parentRuleId}\\u0000${constituentKey}`;
}

''',
'''function nestedTargetKey(parentRuleId: string, constituentKey: string): string {
  return `${parentRuleId}\\u0000${constituentKey}`;
}

const SAMPLER_ALLOCATION_ATTRIBUTION = {
  ruleChildrenCalls: 0,
  ruleChildrenSuccesses: 0,
  constituentVisits: 0,
  positiveCountConstituents: 0,
  occurrenceIterations: 0,
  requirementCalls: 0,
  repeatedRequirementCalls: 0,
  lexicalPathBuilds: 0,
  lexicalPathElements: 0,
  recursivePathBuilds: 0,
  recursivePathElements: 0,
  candidateRulePathBuilds: 0,
  candidateRulePathElements: 0,
  lexicalStateCopies: 0,
  recursiveSuccesses: 0,
  childSlotCopyOperations: 0,
  childSlotItemsCopied: 0,
  childSlotContextCopyOperations: 0,
  childSlotContextItemsCopied: 0,
  childRulePathCopyOperations: 0,
  childRulePathItemsCopied: 0,
  callsUsingChildren: 0,
  callsUsingSlots: 0,
  callsUsingSlotContexts: 0,
  callsUsingRulePath: 0,
  ordinaryCandidateWrapperItems: 0,
};

export function readSamplerAllocationAttribution() {
  return { ...SAMPLER_ALLOCATION_ATTRIBUTION };
}

''',
"stats",
)

once(
'''): SampledRuleChildren | null {
  let workingState = inputState;
  const children: PendingStructuralElement[] = [];
  const slots: StructuralLexicalSlot[] = [];
  const slotContexts: SampledLexicalSlotContext[] = [];
  const rulePath: string[] = [];

  for (const constituent of ordered) {
''',
'''): SampledRuleChildren | null {
  SAMPLER_ALLOCATION_ATTRIBUTION.ruleChildrenCalls += 1;
  let workingState = inputState;
  const children: PendingStructuralElement[] = [];
  const slots: StructuralLexicalSlot[] = [];
  const slotContexts: SampledLexicalSlotContext[] = [];
  const rulePath: string[] = [];
  let usedChildren = false;
  let usedSlots = false;
  let usedSlotContexts = false;
  let usedRulePath = false;

  for (const constituent of ordered) {
    SAMPLER_ALLOCATION_ATTRIBUTION.constituentVisits += 1;
''',
"rule children entry",
)

once(
'''    if (target?.exactCount !== undefined && count !== target.exactCount) return null;

    for (let occurrenceIndex = 0; occurrenceIndex < count; occurrenceIndex += 1) {
      const afterDepth = decrement(workingState, constituent);
      if (afterDepth === null) return null;
      const childRequirements = requirementsForConstituent(constituent, requirements);
      if (childRequirements === null) return null;
''',
'''    if (target?.exactCount !== undefined && count !== target.exactCount) return null;
    if (count > 0) SAMPLER_ALLOCATION_ATTRIBUTION.positiveCountConstituents += 1;
    let constituentRequirementsComputed = false;

    for (let occurrenceIndex = 0; occurrenceIndex < count; occurrenceIndex += 1) {
      SAMPLER_ALLOCATION_ATTRIBUTION.occurrenceIterations += 1;
      const afterDepth = decrement(workingState, constituent);
      if (afterDepth === null) return null;
      SAMPLER_ALLOCATION_ATTRIBUTION.requirementCalls += 1;
      if (constituentRequirementsComputed) {
        SAMPLER_ALLOCATION_ATTRIBUTION.repeatedRequirementCalls += 1;
      }
      const childRequirements = requirementsForConstituent(constituent, requirements);
      if (childRequirements === null) return null;
      constituentRequirementsComputed = true;
''',
"requirements loop",
)

once(
'''        const slot = makeSlot(
          constituent,
          childRequirements,
          occurrenceIndex,
          [...path, constituent.key],
        );
''',
'''        SAMPLER_ALLOCATION_ATTRIBUTION.lexicalPathBuilds += 1;
        SAMPLER_ALLOCATION_ATTRIBUTION.lexicalPathElements += path.length + 1;
        const slot = makeSlot(
          constituent,
          childRequirements,
          occurrenceIndex,
          [...path, constituent.key],
        );
''',
"lexical path",
)

once(
'''        children.push(slot);
        slots.push(slot);
        slotContexts.push({
''',
'''        if (!usedChildren) {
          usedChildren = true;
          SAMPLER_ALLOCATION_ATTRIBUTION.callsUsingChildren += 1;
        }
        if (!usedSlots) {
          usedSlots = true;
          SAMPLER_ALLOCATION_ATTRIBUTION.callsUsingSlots += 1;
        }
        if (!usedSlotContexts) {
          usedSlotContexts = true;
          SAMPLER_ALLOCATION_ATTRIBUTION.callsUsingSlotContexts += 1;
        }
        children.push(slot);
        slots.push(slot);
        slotContexts.push({
''',
"lexical pushes",
)

once(
'''        workingState = { ...workingState, lexicalCount: workingState.lexicalCount + 1 };
''',
'''        SAMPLER_ALLOCATION_ATTRIBUTION.lexicalStateCopies += 1;
        workingState = { ...workingState, lexicalCount: workingState.lexicalCount + 1 };
''',
"lexical state copy",
)

once(
'''      const requestedChildRuleId = target?.childRuleId;
      const child = sampleCategory(
''',
'''      const requestedChildRuleId = target?.childRuleId;
      SAMPLER_ALLOCATION_ATTRIBUTION.recursivePathBuilds += 1;
      SAMPLER_ALLOCATION_ATTRIBUTION.recursivePathElements += path.length + 1;
      const child = sampleCategory(
''',
"recursive path",
)

once(
'''      if (child === null) return null;
      children.push(child.element);
      slots.push(...child.slots);
      slotContexts.push(...child.slotContexts);
      rulePath.push(...child.rulePath);
''',
'''      if (child === null) return null;
      SAMPLER_ALLOCATION_ATTRIBUTION.recursiveSuccesses += 1;
      if (!usedChildren) {
        usedChildren = true;
        SAMPLER_ALLOCATION_ATTRIBUTION.callsUsingChildren += 1;
      }
      children.push(child.element);
      if (child.slots.length > 0) {
        if (!usedSlots) {
          usedSlots = true;
          SAMPLER_ALLOCATION_ATTRIBUTION.callsUsingSlots += 1;
        }
        SAMPLER_ALLOCATION_ATTRIBUTION.childSlotCopyOperations += 1;
        SAMPLER_ALLOCATION_ATTRIBUTION.childSlotItemsCopied += child.slots.length;
        slots.push(...child.slots);
      }
      if (child.slotContexts.length > 0) {
        if (!usedSlotContexts) {
          usedSlotContexts = true;
          SAMPLER_ALLOCATION_ATTRIBUTION.callsUsingSlotContexts += 1;
        }
        SAMPLER_ALLOCATION_ATTRIBUTION.childSlotContextCopyOperations += 1;
        SAMPLER_ALLOCATION_ATTRIBUTION.childSlotContextItemsCopied += child.slotContexts.length;
        slotContexts.push(...child.slotContexts);
      }
      if (child.rulePath.length > 0) {
        if (!usedRulePath) {
          usedRulePath = true;
          SAMPLER_ALLOCATION_ATTRIBUTION.callsUsingRulePath += 1;
        }
        SAMPLER_ALLOCATION_ATTRIBUTION.childRulePathCopyOperations += 1;
        SAMPLER_ALLOCATION_ATTRIBUTION.childRulePathItemsCopied += child.rulePath.length;
        rulePath.push(...child.rulePath);
      }
''',
"recursive copies",
)

once(
'''  return {
    state: workingState,
''',
'''  SAMPLER_ALLOCATION_ATTRIBUTION.ruleChildrenSuccesses += 1;
  return {
    state: workingState,
''',
"success return",
)

once(
'''  const candidates: readonly NestedClauseCandidate[] = orderedLicensingAlternatives
    ? eligibleRules.map((rule) => ({
        rule,
        random: rule.id === "ba-predicate.attested" ? random : DETERMINISTIC_MINIMUM_RANDOM,
      }))
    : stableNestedClause
      ? stableNestedClauseCandidates(eligibleRules, random)
      : shuffled(eligibleRules, random).map((rule) => ({ rule, random }));
''',
'''  if (!orderedLicensingAlternatives && !stableNestedClause) {
    SAMPLER_ALLOCATION_ATTRIBUTION.ordinaryCandidateWrapperItems += eligibleRules.length;
  }
  const candidates: readonly NestedClauseCandidate[] = orderedLicensingAlternatives
    ? eligibleRules.map((rule) => ({
        rule,
        random: rule.id === "ba-predicate.attested" ? random : DETERMINISTIC_MINIMUM_RANDOM,
      }))
    : stableNestedClause
      ? stableNestedClauseCandidates(eligibleRules, random)
      : shuffled(eligibleRules, random).map((rule) => ({ rule, random }));
''',
"ordinary wrappers",
)

once(
'''    const sampledChildren = sampleRuleChildren(
      rule.id,
''',
'''    SAMPLER_ALLOCATION_ATTRIBUTION.candidateRulePathBuilds += 1;
    SAMPLER_ALLOCATION_ATTRIBUTION.candidateRulePathElements += path.length + 1;
    const sampledChildren = sampleRuleChildren(
      rule.id,
''',
"candidate rule path",
)

path.write_text(text)
