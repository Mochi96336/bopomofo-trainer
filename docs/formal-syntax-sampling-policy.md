# Formal syntax sampling policy

The formal grammar and the product sampling policy are different layers.

`src/syntax` answers whether a derivation is legal. It does not assign product frequency to a construction. The curriculum taxonomy classifies legal productions as:

```text
kind -> construction family -> production variant
```

The product policy assigns probability above the raw production level. Production variants are executable implementations inside one construction family; adding or splitting a variant must not create additional family mass or additional root attempts.

## Why this exists

The raw structural sampler randomizes reachable productions. With the current grammar, ten root `Sentence` productions otherwise behave like ten equal tickets before reachability effects:

- statement: 2/10 = 20%
- question: 6/10 = 60%
- request: 1/10 = 10%
- exclamative: 1/10 = 10%

`question.a-not-a` owns two raw tickets only because its intransitive and transitive forms are separate executable productions. That grammar representation detail must not become product frequency.

## Product prior

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

So the nominal A-not-A prior is:

```text
0.26 × 0.25 = 0.065 = 6.5%
```

Both A-not-A productions share that one family mass.

Clause kinds start at 60% core predication, 20% marked, 8% complex-predicate, 7% information-structure, and 5% embedded-content. Current Clause families begin equal inside each kind; variants divide family mass rather than create mass.

## Family-local search without variant-count bias

A second bias appeared after family weights were introduced. One structural attempt per family was not enough: a selected polar question or declarative could fail because one randomly chosen inner Clause expansion was unreachable, and the sampler would immediately fall through to another root family. Constructions that are short and easy to realize, including A-not-A, then absorbed that failed probability.

The product separates **family choice** from **search inside that family**:

1. build one weighted root plan by kind and construction family;
2. give each root family a bounded local search budget derived from the actual number of families and the caller's global attempt budget;
3. on each local attempt, select exactly one executable root production variant from the current family;
4. keep the complete descendant grammar available and redraw lower Clause/Phrase choices normally;
5. only after the current family's local budget is exhausted advance to the next already-ranked family;
6. after one unique candidate is accepted, build a fresh root plan for the next candidate.

The structural sampler therefore exposes a singular `rootProductionRuleId`. One local attempt cannot try every variant in a family sequentially. A family with two executable productions receives the same number of root attempts as a family with one executable production.

The local budget is not a magic constant tied to today's eight families. `rootFamilyAttemptBudget(maximumAttempts, familyCount)` derives it from the actual plan and fails closed if the caller cannot afford at least one attempt per family.

Product-only rejection, such as the current minimum of two practice lexical entries, lexical uniqueness failure, or a duplicate realized candidate, counts against the same family-local budget instead of causing an immediate fresh family draw.

## Sampling mode

`composeFormalSyntaxUtterances()` has an explicit `samplingMode`:

- `product-family`: apply the curriculum family policy;
- `raw`: keep raw structural sampling semantics.

For compatibility, the composer infers `product-family` when the supplied rule IDs exactly match the complete formal grammar and `raw` for custom grammars. Therefore explicitly passing `FORMAL_SYNTAX_RULES` does not silently disable product policy. Callers can still make the mode explicit, and custom rule orderers cannot be combined with product-family mode.

## Effective-distribution guard

The regression calls the actual `composeFormalSyntaxUtterances()` path with the packaged practice catalog, runtime syntax profiles, real product derivation bounds, lexical selection/uniqueness, realization, and the minimum practice length. It does not reimplement a simplified family-search loop in the test.

The deterministic guard has both lower and upper bounds for A-not-A and total questions. This catches both renewed over-representation and accidental disappearance. These are product-health bounds, not corpus-frequency claims.

## Contract

1. Formal grammar remains the legality source of truth.
2. Sampling taxonomy and probability live outside `src/syntax` grammar definitions.
3. Adding or splitting a controlled production requires an explicit taxonomy update.
4. Kind and family weights belong to versioned curriculum policy.
5. Variant count must not create family probability or extra family-local attempts.
6. One family-local attempt targets exactly one root production variant.
7. Root-family budget is derived from the actual plan, not a hard-coded family count.
8. Root targeting never removes descendant grammar.
9. Effective-distribution tests exercise the actual product composer path.
10. Learner adaptation and construction recency remain later policy layers; they do not legalize or invalidate grammar.

Run the diagnostic with:

```sh
npx tsx scripts/audit-formal-syntax-sampling.ts
```

It reports the old equal-production ticket shares and the nominal product family priors. Realized frequencies are guarded separately rather than baked back into grammar.
