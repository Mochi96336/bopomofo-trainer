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

const SAMPLER_POST302_ATTRIBUTION = {
  sampleCategoryCalls: 0,
  eligibleRuleItems: 0,
  shuffledCalls: 0,
  shuffledItems: 0,
  ordinaryCandidateWrapperItems: 0,
  ruleChildrenCalls: 0,
  ruleChildrenSuccesses: 0,
  constituentVisits: 0,
  positiveCountConstituents: 0,
  occurrenceIterations: 0,
  requirementCalls: 0,
  repeatedRequirementCalls: 0,
  lexicalPathExtensions: 0,
  recursivePathExtensions: 0,
  candidateRulePathExtensions: 0,
  rootPathExtensions: 0,
  pathMaterializations: 0,
  pathMaterializedElements: 0,
  lexicalStateCopies: 0,
  depthStateCopies: 0,
  clauseStateCopies: 0,
  recursiveSuccesses: 0,
  childSlotCopyOperations: 0,
  childSlotItemsCopied: 0,
  childSlotContextCopyOperations: 0,
  childSlotContextItemsCopied: 0,
  childRulePathCopyOperations: 0,
  childRulePathItemsCopied: 0,
  categoryRulePathBuilds: 0,
  categoryRulePathItemsCopied: 0,
  constrainedAssignmentArrays: 0,
  constrainedAssignmentItems: 0,
};

export function readSamplerPost302Attribution() {
  return { ...SAMPLER_POST302_ATTRIBUTION };
}

''',
"stats",
)

once(
'''function shuffled<T>(values: readonly T[], random: RandomSource): readonly T[] {
  const result = [...values];
''',
'''function shuffled<T>(values: readonly T[], random: RandomSource): readonly T[] {
  SAMPLER_POST302_ATTRIBUTION.shuffledCalls += 1;
  SAMPLER_POST302_ATTRIBUTION.shuffledItems += values.length;
  const result = [...values];
''',
"shuffled",
)

once(
'''    return { ...state, remainingClauseDepth: state.remainingClauseDepth - 1 };
''',
'''    SAMPLER_POST302_ATTRIBUTION.depthStateCopies += 1;
    return { ...state, remainingClauseDepth: state.remainingClauseDepth - 1 };
''',
"clause depth copy",
)

once(
'''  return { ...state, remainingPhraseDepth: state.remainingPhraseDepth - 1 };
''',
'''  SAMPLER_POST302_ATTRIBUTION.depthStateCopies += 1;
  return { ...state, remainingPhraseDepth: state.remainingPhraseDepth - 1 };
''',
"phrase depth copy",
)

once(
'''function materializeSamplingPath(path: SamplingPathNode): readonly string[] {
  const segments: string[] = [];
  for (let current: SamplingPathNode | null = path; current !== null; current = current.parent) {
    segments.push(current.segment);
  }
''',
'''function materializeSamplingPath(path: SamplingPathNode): readonly string[] {
  SAMPLER_POST302_ATTRIBUTION.pathMaterializations += 1;
  const segments: string[] = [];
  for (let current: SamplingPathNode | null = path; current !== null; current = current.parent) {
    SAMPLER_POST302_ATTRIBUTION.pathMaterializedElements += 1;
    segments.push(current.segment);
  }
''',
"path materialization",
)

once(
'''): SampledRuleChildren | null {
  let workingState = inputState;
  const children: PendingStructuralElement[] = [];
''',
'''): SampledRuleChildren | null {
  SAMPLER_POST302_ATTRIBUTION.ruleChildrenCalls += 1;
  let workingState = inputState;
  const children: PendingStructuralElement[] = [];
''',
"rule children entry",
)

once(
'''  for (const constituent of ordered) {
    const maximum = effectiveConstituentMaximum(constituent, bounds);
''',
'''  for (const constituent of ordered) {
    SAMPLER_POST302_ATTRIBUTION.constituentVisits += 1;
    const maximum = effectiveConstituentMaximum(constituent, bounds);
''',
"constituent visit",
)

once(
'''    if (target?.exactCount !== undefined && count !== target.exactCount) return null;

    for (let occurrenceIndex = 0; occurrenceIndex < count; occurrenceIndex += 1) {
      const afterDepth = decrement(workingState, constituent);
      if (afterDepth === null) return null;
      const childRequirements = requirementsForConstituent(constituent, requirements);
''',
'''    if (target?.exactCount !== undefined && count !== target.exactCount) return null;
    if (count > 0) SAMPLER_POST302_ATTRIBUTION.positiveCountConstituents += 1;
    let constituentRequirementsComputed = false;

    for (let occurrenceIndex = 0; occurrenceIndex < count; occurrenceIndex += 1) {
      SAMPLER_POST302_ATTRIBUTION.occurrenceIterations += 1;
      const afterDepth = decrement(workingState, constituent);
      if (afterDepth === null) return null;
      SAMPLER_POST302_ATTRIBUTION.requirementCalls += 1;
      if (constituentRequirementsComputed) SAMPLER_POST302_ATTRIBUTION.repeatedRequirementCalls += 1;
      const childRequirements = requirementsForConstituent(constituent, requirements);
''',
"requirements",
)

once(
'''      if (childRequirements === null) return null;
      workingState = afterDepth;
''',
'''      if (childRequirements === null) return null;
      constituentRequirementsComputed = true;
      workingState = afterDepth;
''',
"requirements computed",
)

once(
'''        const slot = makeSlot(
          constituent,
          childRequirements,
          occurrenceIndex,
          extendSamplingPath(path, constituent.key),
        );
''',
'''        SAMPLER_POST302_ATTRIBUTION.lexicalPathExtensions += 1;
        const slot = makeSlot(
          constituent,
          childRequirements,
          occurrenceIndex,
          extendSamplingPath(path, constituent.key),
        );
''',
"lexical path extension",
)

once(
'''        workingState = { ...workingState, lexicalCount: workingState.lexicalCount + 1 };
''',
'''        SAMPLER_POST302_ATTRIBUTION.lexicalStateCopies += 1;
        workingState = { ...workingState, lexicalCount: workingState.lexicalCount + 1 };
''',
"lexical state copy",
)

once(
'''      const requestedChildRuleId = target?.childRuleId;
      const child = sampleCategory(
''',
'''      const requestedChildRuleId = target?.childRuleId;
      SAMPLER_POST302_ATTRIBUTION.recursivePathExtensions += 1;
      const child = sampleCategory(
''',
"recursive extension",
)

once(
'''      if (child === null) return null;
      children.push(child.element);
      slots.push(...child.slots);
      slotContexts.push(...child.slotContexts);
      rulePath.push(...child.rulePath);
''',
'''      if (child === null) return null;
      SAMPLER_POST302_ATTRIBUTION.recursiveSuccesses += 1;
      children.push(child.element);
      if (child.slots.length > 0) {
        SAMPLER_POST302_ATTRIBUTION.childSlotCopyOperations += 1;
        SAMPLER_POST302_ATTRIBUTION.childSlotItemsCopied += child.slots.length;
      }
      slots.push(...child.slots);
      if (child.slotContexts.length > 0) {
        SAMPLER_POST302_ATTRIBUTION.childSlotContextCopyOperations += 1;
        SAMPLER_POST302_ATTRIBUTION.childSlotContextItemsCopied += child.slotContexts.length;
      }
      slotContexts.push(...child.slotContexts);
      if (child.rulePath.length > 0) {
        SAMPLER_POST302_ATTRIBUTION.childRulePathCopyOperations += 1;
        SAMPLER_POST302_ATTRIBUTION.childRulePathItemsCopied += child.rulePath.length;
      }
      rulePath.push(...child.rulePath);
''',
"child copies",
)

once(
'''  return {
    state: workingState,
    children,
''',
'''  SAMPLER_POST302_ATTRIBUTION.ruleChildrenSuccesses += 1;
  return {
    state: workingState,
    children,
''',
"rule children success",
)

once(
'''): Sampled | null {
  let state = inputState;
  if (category === "Clause" || category === "OpenClause") {
''',
'''): Sampled | null {
  SAMPLER_POST302_ATTRIBUTION.sampleCategoryCalls += 1;
  let state = inputState;
  if (category === "Clause" || category === "OpenClause") {
''',
"category entry",
)

once(
'''    state = { ...state, clauseCount: state.clauseCount + 1 };
''',
'''    SAMPLER_POST302_ATTRIBUTION.clauseStateCopies += 1;
    state = { ...state, clauseCount: state.clauseCount + 1 };
''',
"clause state copy",
)

once(
'''  const eligibleRules = (rulesByOutput.get(category) ?? [])
    .filter((rule) => ruleAllowedByDerivationBounds(rule, bounds, excludedRuleClasses))
    .filter((rule) => !isRoot || rootProductionRuleId === undefined || rule.id === rootProductionRuleId)
    .filter((rule) => requestedProductionRuleId === undefined || rule.id === requestedProductionRuleId);
''',
'''  const eligibleRules = (rulesByOutput.get(category) ?? [])
    .filter((rule) => ruleAllowedByDerivationBounds(rule, bounds, excludedRuleClasses))
    .filter((rule) => !isRoot || rootProductionRuleId === undefined || rule.id === rootProductionRuleId)
    .filter((rule) => requestedProductionRuleId === undefined || rule.id === requestedProductionRuleId);
  SAMPLER_POST302_ATTRIBUTION.eligibleRuleItems += eligibleRules.length;
''',
"eligible rules",
)

once(
'''  const candidates: readonly NestedClauseCandidate[] = orderedLicensingAlternatives
''',
'''  if (!orderedLicensingAlternatives && !stableNestedClause) {
    SAMPLER_POST302_ATTRIBUTION.ordinaryCandidateWrapperItems += eligibleRules.length;
  }
  const candidates: readonly NestedClauseCandidate[] = orderedLicensingAlternatives
''',
"candidate wrappers",
)

once(
'''      fixedCounts = assignments[chooseIndex(candidateRandom, assignments.length)];
''',
'''      SAMPLER_POST302_ATTRIBUTION.constrainedAssignmentArrays += 1;
      SAMPLER_POST302_ATTRIBUTION.constrainedAssignmentItems += assignments.length;
      fixedCounts = assignments[chooseIndex(candidateRandom, assignments.length)];
''',
"assignments",
)

once(
'''    const sampledChildren = sampleRuleChildren(
      rule.id,
''',
'''    SAMPLER_POST302_ATTRIBUTION.candidateRulePathExtensions += 1;
    const sampledChildren = sampleRuleChildren(
      rule.id,
''',
"candidate extension",
)

once(
'''    return {
      element: node,
      state: sampledChildren.state,
      rulePath: [rule.id, ...sampledChildren.rulePath],
''',
'''    SAMPLER_POST302_ATTRIBUTION.categoryRulePathBuilds += 1;
    SAMPLER_POST302_ATTRIBUTION.categoryRulePathItemsCopied += sampledChildren.rulePath.length + 1;
    return {
      element: node,
      state: sampledChildren.state,
      rulePath: [rule.id, ...sampledChildren.rulePath],
''',
"category rule path",
)

once(
'''      extendSamplingPath(null, options.rootCategory),
''',
'''      (SAMPLER_POST302_ATTRIBUTION.rootPathExtensions += 1,
        extendSamplingPath(null, options.rootCategory)),
''',
"root extension",
)

path.write_text(text)
