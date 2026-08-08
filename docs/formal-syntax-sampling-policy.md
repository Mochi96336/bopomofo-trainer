# Formal syntax sampling policy

The formal grammar and the product sampling policy are different layers.

`src/syntax` answers whether a derivation is legal. It does not assign product frequency to a construction. The curriculum taxonomy classifies legal productions as:

```text
kind -> construction family -> production variant
```

This PR applies product probability only to **Sentence-root construction families**. Production variants are executable implementations inside one root family; adding or splitting a variant must not create additional root family mass or additional root attempts.

## Why this exists

The raw structural sampler randomizes reachable productions. With the current grammar, ten root `Sentence` productions otherwise behave like ten equal tickets before reachability effects:

- statement: 2/10 = 20%
- question: 6/10 = 60%
- request: 1/10 = 10%
- exclamative: 1/10 = 10%

`question.a-not-a` owns two raw tickets only because its intransitive and transitive forms are separate executable productions. That grammar representation detail must not become product frequency.

## Sentence-root product prior

`PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY` is a training prior, not a claim about natural Mandarin corpus frequencies.

Root kinds start at:

- statement: 64%
- question: 26%
- request: 6%
- exclamative: 4%

Question mass is divided by construction family:

- polar: 35% of question mass
- constituent: 30%
- A-not-A: 25%
- alternative: 10%

So the nominal A-not-A root prior is:

```text
0.26 × 0.25 = 0.065 = 6.5%
```

Both A-not-A productions share that one family mass.

The root fallback plan is a single weighted permutation over all Sentence families using the joint family weight:

```text
P(family) = P(kind) × P(family | kind)
```

It does **not** first choose a kind and then place every family from that kind contiguously. A question family therefore does not gain extra fallback positions merely because `question` contains more construction families than `request` or `exclamative`.

## Family-local root search

One structural attempt per family was not enough: a selected polar question or declarative could fail because one randomly chosen descendant expansion was unreachable, and the sampler would immediately fall through to another root family. Short or easy-to-realize constructions could then absorb too much failed mass.

The product separates root family choice from bounded search inside that family:

1. build one joint-weighted Sentence-family fallback plan;
2. give each root family a bounded local search budget derived from the actual family count and the caller's global attempt budget;
3. on each local attempt, select exactly one executable root production variant from the current family;
4. keep the complete descendant grammar available and redraw descendant choices normally;
5. only after the current family's local budget is exhausted advance to the next family in the joint-weighted plan;
6. after one unique candidate is accepted, build a fresh root plan for the next candidate.

The structural sampler therefore exposes a singular `rootProductionRuleId`. One local attempt cannot try every variant in a family sequentially. A family with two executable productions receives the same number of root attempts as a family with one executable production.

The local budget is not a magic constant tied to today's eight families. `rootFamilyAttemptBudget(maximumAttempts, familyCount)` derives it from the actual plan. A fresh family plan starts only when the remaining global budget can afford at least one attempt per family; otherwise candidate generation stops cleanly with `formal-syntax-root-family-budget-insufficient` instead of throwing. The production path currently requests one candidate with a 64-attempt budget.

Product-only rejection, such as the current minimum of two practice lexical entries, lexical uniqueness failure, or a duplicate realized candidate, counts against the same family-local budget instead of causing an immediate fresh family draw.

This does not imply that realized output frequencies exactly equal the nominal root prior. Reachability, descendant structural sampling, lexical realization, and eventual fallback can still change effective shares. The policy removes representation-count bias at the Sentence root and bounds one-shot failover; effective output remains something to measure rather than assert from the nominal prior.

## Clause and lower categories

Clause taxonomy remains useful for audit and future policy work, but #155 does **not** assign product Clause probabilities.

Nested `Clause`, phrase, and lower-category choices continue to use the raw structural sampler. A proper Clause probability policy would require nested family-local sampling, not merely a weighted rule orderer, because even singleton Clause families can still exhibit success-rate/failover bias.

That work is intentionally outside this PR.

## Sampling mode and canonical grammar identity

`composeFormalSyntaxUtterances()` has an explicit `samplingMode`:

- `product-family`: apply the Sentence-root curriculum family policy;
- `raw`: keep raw structural sampling semantics.

The composer infers `product-family` only when the supplied rules match the canonical complete `FORMAL_SYNTAX_RULES`, including rule content, not merely the same IDs. Same-ID but structurally modified rules are custom grammar and infer `raw`; explicitly requesting `product-family` with such rules fails closed.

Explicitly passing the canonical `FORMAL_SYNTAX_RULES` does not silently disable product policy. Custom rule orderers cannot be combined with product-family mode.

## Effective-distribution guard

The regression calls the actual `composeFormalSyntaxUtterances()` path with the packaged practice catalog, runtime syntax profiles, real product derivation bounds, lexical selection/uniqueness, realization, and the minimum practice length. It does not reimplement a simplified family-search loop in the test.

The deterministic guard has both lower and upper bounds for A-not-A and total questions. This catches renewed over-representation and accidental disappearance. These are product-health bounds, not evidence that realized output must numerically match the nominal prior.

## Contract

1. Formal grammar remains the legality source of truth.
2. Sampling taxonomy and probability live outside `src/syntax` grammar definitions.
3. Adding or splitting a controlled production requires an explicit taxonomy update.
4. #155 product probability applies to Sentence-root construction families only.
5. Sentence fallback order uses joint family weight, not contiguous kind blocks.
6. Root production variant count must not create family probability or extra family-local attempts.
7. One family-local attempt targets exactly one root production variant.
8. Root-family budget is derived from the actual plan, not a hard-coded family count.
9. Insufficient remaining candidate-search budget returns an explicit fallback instead of an exception.
10. Root targeting never removes descendant grammar.
11. Clause and lower-category choices remain raw until nested family-local sampling is designed explicitly.
12. Product-family mode requires the canonical complete formal grammar, not just matching rule IDs.
13. Effective-distribution tests exercise the actual product composer path.
14. Learner adaptation and construction recency remain later policy layers; they do not legalize or invalidate grammar.

Run the diagnostic with:

```sh
npx tsx scripts/audit-formal-syntax-sampling.ts
```

It reports the old equal-production ticket shares and the nominal Sentence-root family priors. Realized frequencies are guarded separately rather than baked back into grammar.
