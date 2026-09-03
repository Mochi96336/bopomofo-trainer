from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"{label} marker not found")
    return text.replace(old, new, 1)


policy = Path("src/curriculum/formal-syntax-sampling-policy.ts")
text = policy.read_text()
text = replace_once(
    text,
    'version: "formal-syntax-family-sampling-v4"',
    'version: "formal-syntax-family-sampling-v5"',
    "sampling policy version",
)
text = replace_once(
    text,
    """  // Mechanism-first default: no marking ticket, so v4 is behavior-neutral
  // until an explicit measured product prior is chosen.
  predicateMarkingPracticeWeights: { ordinary: 1, negation: 0 },""",
    """  // Product-practice prior measured after Clause-level negation retirement.
  // A 4% marking ticket restored 324/2048 negative candidates versus the
  // pre-retirement 328/2048 baseline without restoring a negation root family.
  predicateMarkingPracticeWeights: { ordinary: 0.96, negation: 0.04 },""",
    "marking prior",
)
policy.write_text(text)

utterance = Path("src/curriculum/formal-syntax-utterance.ts")
text = utterance.read_text()
text = replace_once(
    text,
    """  let rootFamilyPlan: readonly SentenceConstructionFamilyPlan[] | null = null;
  let rootFamilyIndex = 0;
  let attemptsInRootFamily = 0;
  let attemptsPerRootFamily = 0;
  let rootFamilyBudgetInsufficient = false;
  let predicateMarkingPracticeIntent: PredicateMarkingPracticeIntent = \"ordinary\";

  const currentRootFamily = (remainingAttempts: number): SentenceConstructionFamilyPlan | null => {
    if (!useProductFamilyPolicy || samplingPolicy === null) return null;
    if (rootFamilyPlan === null) {
      rootFamilyPlan = createSentenceConstructionFamilyPlan(
        sentenceRules,
        input.random,
        samplingPolicy,
      );
      predicateMarkingPracticeIntent = predicateMarkingPracticeIntentForFamilyPlan(
        rootFamilyPlan,
        samplingPolicy,
      );
      rootFamilyIndex = 0;
      attemptsInRootFamily = 0;
      rootFamilyBudgetInsufficient = remainingAttempts < rootFamilyPlan.length;
      if (rootFamilyBudgetInsufficient) return null;
      attemptsPerRootFamily = rootFamilyAttemptBudget(remainingAttempts, rootFamilyPlan.length);
    }
    return rootFamilyPlan[rootFamilyIndex] ?? null;
  };""",
    """  let rootFamilySearch: {
    readonly plan: readonly SentenceConstructionFamilyPlan[];
    readonly predicateMarkingPracticeIntent: PredicateMarkingPracticeIntent;
  } | null = null;
  let rootFamilyIndex = 0;
  let attemptsInRootFamily = 0;
  let attemptsPerRootFamily = 0;
  let rootFamilyBudgetInsufficient = false;

  const currentRootFamily = (remainingAttempts: number): SentenceConstructionFamilyPlan | null => {
    if (!useProductFamilyPolicy || samplingPolicy === null) return null;
    if (rootFamilySearch === null) {
      const plan = createSentenceConstructionFamilyPlan(
        sentenceRules,
        input.random,
        samplingPolicy,
      );
      rootFamilySearch = {
        plan,
        predicateMarkingPracticeIntent: predicateMarkingPracticeIntentForFamilyPlan(
          plan,
          samplingPolicy,
        ),
      };
      rootFamilyIndex = 0;
      attemptsInRootFamily = 0;
      rootFamilyBudgetInsufficient = remainingAttempts < plan.length;
      if (rootFamilyBudgetInsufficient) return null;
      attemptsPerRootFamily = rootFamilyAttemptBudget(remainingAttempts, plan.length);
    }
    return rootFamilySearch.plan[rootFamilyIndex] ?? null;
  };""",
    "root family search",
)
text = replace_once(
    text,
    """  const resetRootFamilySearch = (): void => {
    rootFamilyPlan = null;
    rootFamilyIndex = 0;
    attemptsInRootFamily = 0;
    attemptsPerRootFamily = 0;
    rootFamilyBudgetInsufficient = false;
    predicateMarkingPracticeIntent = \"ordinary\";
  };""",
    """  const resetRootFamilySearch = (): void => {
    rootFamilySearch = null;
    rootFamilyIndex = 0;
    attemptsInRootFamily = 0;
    attemptsPerRootFamily = 0;
    rootFamilyBudgetInsufficient = false;
  };""",
    "root family reset",
)
text = replace_once(
    text,
    """    const requiresNegationPractice = useProductFamilyPolicy
    && (predicateMarkingPracticeIntent as PredicateMarkingPracticeIntent) === \"negation\";
  const rootProductionRuleId = rootFamily === null""",
    """    const requiresNegationPractice = rootFamilySearch?.predicateMarkingPracticeIntent === \"negation\";
    const rootProductionRuleId = rootFamily === null""",
    "marking intent use",
)
utterance.write_text(text)

sampler = Path("src/syntax/sample.ts")
text = sampler.read_text()
text = replace_once(
    text,
    """    if (sampled === null || sampled.element.kind !== \"syntax-node\") continue;
    if (options.requiredLexicalSlotFeatures !== undefined
      && !sampled.slots.some((slot) =>
        lexicalSlotMatchesRequiredFeatures(slot, options.requiredLexicalSlotFeatures!),
      )) continue;""",
    """    if (sampled === null || sampled.element.kind !== \"syntax-node\") continue;
    const requiredLexicalSlotFeatures = options.requiredLexicalSlotFeatures;
    if (requiredLexicalSlotFeatures !== undefined
      && !sampled.slots.some((slot) =>
        lexicalSlotMatchesRequiredFeatures(slot, requiredLexicalSlotFeatures),
      )) continue;""",
    "sampler required lexical features",
)
sampler.write_text(text)

test = Path("tests/curriculum/predicate-marking-practice-ticket.test.ts")
text = test.read_text()
text = replace_once(
    text,
    """  it(\"keeps the mechanism-first default ordinary and supports an explicit negation ticket\", () => {
    expect(predicateMarkingPracticeIntentForFamilyPlan(PLAN)).toBe(\"ordinary\");
    expect(predicateMarkingPracticeIntentForFamilyPlan(PLAN, {
      ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
      version: \"predicate-marking-ticket-test-always-negation\",
      predicateMarkingPracticeWeights: { ordinary: 0, negation: 1 },
    })).toBe(\"negation\");
  });""",
    """  it(\"supports explicit ordinary and negation practice tickets\", () => {
    expect(predicateMarkingPracticeIntentForFamilyPlan(PLAN, {
      ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
      version: \"predicate-marking-ticket-test-always-ordinary\",
      predicateMarkingPracticeWeights: { ordinary: 1, negation: 0 },
    })).toBe(\"ordinary\");
    expect(predicateMarkingPracticeIntentForFamilyPlan(PLAN, {
      ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
      version: \"predicate-marking-ticket-test-always-negation\",
      predicateMarkingPracticeWeights: { ordinary: 0, negation: 1 },
    })).toBe(\"negation\");
  });

  it(\"uses the measured four-percent product marking prior\", () => {
    expect(PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY.version).toBe(\"formal-syntax-family-sampling-v5\");
    expect(PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY.predicateMarkingPracticeWeights).toEqual({
      ordinary: 0.96,
      negation: 0.04,
    });
  });""",
    "ticket behavior test",
)
text = replace_once(
    text,
    """      expect(composition.candidates[0]!.text).toMatch(/[不未別沒非無]/u);
    }
  });
});""",
    """      expect(composition.candidates[0]!.text).toMatch(/[不未別沒非無]/u);
    }
  }, 30_000);
});""",
    "ticket integration timeout",
)
test.write_text(text)
