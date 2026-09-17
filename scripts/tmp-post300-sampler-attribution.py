from pathlib import Path

p = Path("src/syntax/sample.ts")
s = p.read_text()

def once(old: str, new: str, label: str) -> None:
    global s
    if old not in s:
        raise SystemExit(f"{label} anchor missing")
    s = s.replace(old, new, 1)

once(
    'const DETERMINISTIC_MINIMUM_RANDOM: RandomSource = { next: () => 0 };\n\n',
    '''const DETERMINISTIC_MINIMUM_RANDOM: RandomSource = { next: () => 0 };\n\nconst SAMPLER_ATTRIBUTION = {\n  structuralCalls: 0,\n  structuralAttempts: 0,\n  rootSampleNulls: 0,\n  requiredLexicalRejects: 0,\n  requiredProductionRejects: 0,\n  sampleCategoryCalls: 0,\n  categoryClauseLimitNulls: 0,\n  categorySuccesses: 0,\n  categoryExhaustedNulls: 0,\n  categoryRulePoolItems: 0,\n  eligibleRuleItems: 0,\n  shuffleCalls: 0,\n  shuffleItems: 0,\n  stableNestedCandidateCalls: 0,\n  stableNestedCandidateItems: 0,\n  nestedKeyPriorityCalls: 0,\n  nestedKeyCandidateCalls: 0,\n  nestedKeyChars: 0,\n  candidateVisits: 0,\n  constrainedCandidateVisits: 0,\n  assignmentsGenerated: 0,\n  assignmentsAfterTargetFilter: 0,\n  assignmentEmptyRejects: 0,\n  sampleRuleChildrenCalls: 0,\n  sampleRuleChildrenSuccesses: 0,\n  childFailMaximumBelowMinimum: 0,\n  childFailCountBounds: 0,\n  childFailExactCount: 0,\n  childFailDepth: 0,\n  childFailRequirements: 0,\n  childFailLexicalLimit: 0,\n  childFailReachability: 0,\n  childFailRecursiveChild: 0,\n  lexicalSlotsBuilt: 0,\n  nonLexicalChildRecursions: 0,\n};\n\nexport function readSamplerAttribution() {\n  return { ...SAMPLER_ATTRIBUTION };\n}\n\n''',
    "stats block",
)

once(
    'function shuffled<T>(values: readonly T[], random: RandomSource): readonly T[] {\n  const result = [...values];\n',
    'function shuffled<T>(values: readonly T[], random: RandomSource): readonly T[] {\n  SAMPLER_ATTRIBUTION.shuffleCalls += 1;\n  SAMPLER_ATTRIBUTION.shuffleItems += values.length;\n  const result = [...values];\n',
    "shuffle",
)

once(
    '): string {\n  // These keys are already in stableRuntimeDigest canonical sort order:\n  // purpose, ruleId, ticket, version. Keep this byte-for-byte equivalent.\n  return JSON.stringify({\n    purpose,\n    ruleId,\n    ticket,\n    version: NESTED_CLAUSE_RULE_ORDER_VERSION,\n  });\n}\n',
    '''): string {\n  if (purpose === "priority") SAMPLER_ATTRIBUTION.nestedKeyPriorityCalls += 1;\n  else SAMPLER_ATTRIBUTION.nestedKeyCandidateCalls += 1;\n  // These keys are already in stableRuntimeDigest canonical sort order:\n  // purpose, ruleId, ticket, version. Keep this byte-for-byte equivalent.\n  const source = JSON.stringify({\n    purpose,\n    ruleId,\n    ticket,\n    version: NESTED_CLAUSE_RULE_ORDER_VERSION,\n  });\n  SAMPLER_ATTRIBUTION.nestedKeyChars += source.length;\n  return source;\n}\n''',
    "nested key",
)

once(
    '): readonly NestedClauseCandidate[] {\n  if (values.length === 0) return [];\n',
    '): readonly NestedClauseCandidate[] {\n  SAMPLER_ATTRIBUTION.stableNestedCandidateCalls += 1;\n  SAMPLER_ATTRIBUTION.stableNestedCandidateItems += values.length;\n  if (values.length === 0) return [];\n',
    "nested candidates",
)

once(
    '): SampledRuleChildren | null {\n  let workingState = inputState;\n',
    '): SampledRuleChildren | null {\n  SAMPLER_ATTRIBUTION.sampleRuleChildrenCalls += 1;\n  let workingState = inputState;\n',
    "children call",
)

once(
    '    if (maximum < constituent.minimum) return null;\n',
    '    if (maximum < constituent.minimum) {\n      SAMPLER_ATTRIBUTION.childFailMaximumBelowMinimum += 1;\n      return null;\n    }\n',
    "maximum failure",
)
once(
    '    if (count < constituent.minimum || count > maximum) return null;\n',
    '    if (count < constituent.minimum || count > maximum) {\n      SAMPLER_ATTRIBUTION.childFailCountBounds += 1;\n      return null;\n    }\n',
    "count failure",
)
once(
    '    if (target?.exactCount !== undefined && count !== target.exactCount) return null;\n',
    '    if (target?.exactCount !== undefined && count !== target.exactCount) {\n      SAMPLER_ATTRIBUTION.childFailExactCount += 1;\n      return null;\n    }\n',
    "exact failure",
)
once(
    '      if (afterDepth === null) return null;\n',
    '      if (afterDepth === null) {\n        SAMPLER_ATTRIBUTION.childFailDepth += 1;\n        return null;\n      }\n',
    "depth failure",
)
once(
    '      if (childRequirements === null) return null;\n',
    '      if (childRequirements === null) {\n        SAMPLER_ATTRIBUTION.childFailRequirements += 1;\n        return null;\n      }\n',
    "requirements failure",
)
once(
    '        if (workingState.lexicalCount >= bounds.maximumLexicalEntriesPerUtterance) return null;\n        const slot = makeSlot(\n',
    '        if (workingState.lexicalCount >= bounds.maximumLexicalEntriesPerUtterance) {\n          SAMPLER_ATTRIBUTION.childFailLexicalLimit += 1;\n          return null;\n        }\n        SAMPLER_ATTRIBUTION.lexicalSlotsBuilt += 1;\n        const slot = makeSlot(\n',
    "lexical limit",
)
once(
    '        if (isLexicalSlotReachable !== undefined && !isLexicalSlotReachable(slot)) return null;\n',
    '        if (isLexicalSlotReachable !== undefined && !isLexicalSlotReachable(slot)) {\n          SAMPLER_ATTRIBUTION.childFailReachability += 1;\n          return null;\n        }\n',
    "reachability failure",
)
once(
    '      const requestedChildRuleId = target?.childRuleId;\n      const child = sampleCategory(\n',
    '      const requestedChildRuleId = target?.childRuleId;\n      SAMPLER_ATTRIBUTION.nonLexicalChildRecursions += 1;\n      const child = sampleCategory(\n',
    "child recursion",
)
once(
    '      if (child === null) return null;\n',
    '      if (child === null) {\n        SAMPLER_ATTRIBUTION.childFailRecursiveChild += 1;\n        return null;\n      }\n',
    "recursive child failure",
)
once(
    '  return {\n    state: workingState,\n    children,\n',
    '  SAMPLER_ATTRIBUTION.sampleRuleChildrenSuccesses += 1;\n  return {\n    state: workingState,\n    children,\n',
    "children success",
)

once(
    '): Sampled | null {\n  let state = inputState;\n',
    '): Sampled | null {\n  SAMPLER_ATTRIBUTION.sampleCategoryCalls += 1;\n  let state = inputState;\n',
    "category calls",
)
once(
    '    if (state.clauseCount >= bounds.maximumClausesPerSentence) return null;\n',
    '    if (state.clauseCount >= bounds.maximumClausesPerSentence) {\n      SAMPLER_ATTRIBUTION.categoryClauseLimitNulls += 1;\n      return null;\n    }\n',
    "clause limit",
)
once(
    '  const eligibleRules = (rulesByOutput.get(category) ?? [])\n    .filter((rule) => ruleAllowedByDerivationBounds(rule, bounds, excludedRuleClasses))\n',
    '  const categoryRules = rulesByOutput.get(category) ?? [];\n  SAMPLER_ATTRIBUTION.categoryRulePoolItems += categoryRules.length;\n  const eligibleRules = categoryRules\n    .filter((rule) => ruleAllowedByDerivationBounds(rule, bounds, excludedRuleClasses))\n',
    "rule pool",
)
once(
    '    .filter((rule) => requestedProductionRuleId === undefined || rule.id === requestedProductionRuleId);\n',
    '    .filter((rule) => requestedProductionRuleId === undefined || rule.id === requestedProductionRuleId);\n  SAMPLER_ATTRIBUTION.eligibleRuleItems += eligibleRules.length;\n',
    "eligible rules",
)
once(
    '  for (const candidate of candidates) {\n    const { rule } = candidate;\n',
    '  for (const candidate of candidates) {\n    SAMPLER_ATTRIBUTION.candidateVisits += 1;\n    const { rule } = candidate;\n',
    "candidate visits",
)
once(
    '    if (rule.constraints.length > 0) {\n      const assignments = [...validConstituentCountAssignments(rule, bounds)].filter((assignment) =>\n',
    '    if (rule.constraints.length > 0) {\n      SAMPLER_ATTRIBUTION.constrainedCandidateVisits += 1;\n      const generatedAssignments = [...validConstituentCountAssignments(rule, bounds)];\n      SAMPLER_ATTRIBUTION.assignmentsGenerated += generatedAssignments.length;\n      const assignments = generatedAssignments.filter((assignment) =>\n',
    "assignments generated",
)
once(
    '      );\n      if (assignments.length === 0) continue;\n      fixedCounts = assignments[chooseIndex(candidateRandom, assignments.length)];\n',
    '      );\n      SAMPLER_ATTRIBUTION.assignmentsAfterTargetFilter += assignments.length;\n      if (assignments.length === 0) {\n        SAMPLER_ATTRIBUTION.assignmentEmptyRejects += 1;\n        continue;\n      }\n      fixedCounts = assignments[chooseIndex(candidateRandom, assignments.length)];\n',
    "assignments filtered",
)
once(
    '    return {\n      element: node,\n',
    '    SAMPLER_ATTRIBUTION.categorySuccesses += 1;\n    return {\n      element: node,\n',
    "category success",
)
once(
    '  }\n  return null;\n}\n\nfunction validatedRootRuleId',
    '  }\n  SAMPLER_ATTRIBUTION.categoryExhaustedNulls += 1;\n  return null;\n}\n\nfunction validatedRootRuleId',
    "category exhausted",
)

once(
    '): StructuralDerivationShape | null {\n  const bounds = options.bounds ?? DEFAULT_DERIVATION_BOUNDS;\n',
    '): StructuralDerivationShape | null {\n  SAMPLER_ATTRIBUTION.structuralCalls += 1;\n  const bounds = options.bounds ?? DEFAULT_DERIVATION_BOUNDS;\n',
    "structural calls",
)
once(
    '  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {\n    const sampled = sampleCategory(\n',
    '  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {\n    SAMPLER_ATTRIBUTION.structuralAttempts += 1;\n    const sampled = sampleCategory(\n',
    "structural attempts",
)
once(
    '    if (sampled === null || sampled.element.kind !== "syntax-node") continue;\n',
    '    if (sampled === null || sampled.element.kind !== "syntax-node") {\n      SAMPLER_ATTRIBUTION.rootSampleNulls += 1;\n      continue;\n    }\n',
    "root nulls",
)
once(
    '    if (requiredLexicalSlot !== undefined\n      && !sampled.slotContexts.some((context) =>\n        lexicalSlotMatchesConstraint(context, requiredLexicalSlot),\n      )) continue;\n',
    '    if (requiredLexicalSlot !== undefined\n      && !sampled.slotContexts.some((context) =>\n        lexicalSlotMatchesConstraint(context, requiredLexicalSlot),\n      )) {\n      SAMPLER_ATTRIBUTION.requiredLexicalRejects += 1;\n      continue;\n    }\n',
    "required lexical",
)
once(
    '    if (requiredProductionRuleIdsAnyOf !== undefined\n      && !requiredProductionRuleIdsAnyOf.some((ruleId) => sampled.rulePath.includes(ruleId))) continue;\n',
    '    if (requiredProductionRuleIdsAnyOf !== undefined\n      && !requiredProductionRuleIdsAnyOf.some((ruleId) => sampled.rulePath.includes(ruleId))) {\n      SAMPLER_ATTRIBUTION.requiredProductionRejects += 1;\n      continue;\n    }\n',
    "required production",
)

p.write_text(s)
