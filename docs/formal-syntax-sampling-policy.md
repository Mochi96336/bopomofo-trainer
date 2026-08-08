# Formal syntax sampling policy

The formal grammar and the product sampling policy are different layers.

`src/syntax` answers whether a derivation is legal. It does not assign product frequency to a construction. The curriculum taxonomy classifies legal productions as:

```text
kind -> construction family -> production variant
```

The product policy assigns probability above the raw production level. Variants only divide the mass already assigned to their construction family.

## Why this exists

The raw structural sampler randomizes reachable productions. With the current grammar, that means ten root `Sentence` productions behave like ten equal tickets before reachability/failover effects:

- statement: 2/10 = 20%
- question: 6/10 = 60%
- request: 1/10 = 10%
- exclamative: 1/10 = 10%

`question.a-not-a` owns two of those raw tickets solely because intransitive and transitive A-not-A are separate executable productions. `question.constituent` has the same implementation duplication. That is a grammar representation detail, not a sensible curriculum prior.

The same leakage exists at `Clause`: the complete grammar currently has 24 Clause productions, including four embedded/content rules from `complement-rules.ts`.

## Product prior

`PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY` is a training prior, not a claim about natural Mandarin corpus frequencies.

Root kinds start at:

- statement: 64%
- question: 26%
- request: 6%
- exclamative: 4%

Question mass is then divided by construction family:

- polar: 35% of question mass
- constituent: 30%
- A-not-A: 25%
- alternative: 10%

The nominal A-not-A prior is therefore:

```text
0.26 × 0.25 = 0.065 = 6.5%
```

Both A-not-A productions share that same 6.5% family mass. Adding another executable A-not-A variant does not create another top-level ticket.

Clause kinds start at:

- core predication: 60%
- marked constructions: 20%
- complex predicates: 8%
- information structure/omission: 7%
- embedded/content clauses: 5%

Current Clause families begin equal within their coarse kind. The important boundary is still explicit: a future split of `marked.bei`, `marked.ba`, or another construction into multiple production variants does not increase the construction's family mass.

## Failover semantics

Sampling uses weighted ordering without replacement:

1. choose an available kind by weight;
2. choose an available construction family inside it by weight;
3. shuffle executable variants inside that family;
4. try all variants in the selected family before falling through to the next weighted family/kind.

Unavailable kinds or families are naturally renormalized among those still present. A policy never filters grammar rules or makes an illegal derivation legal.

The raw `sampleStructuralDerivation()` API keeps its existing uniform-shuffle behavior unless a caller supplies a rule orderer. The curriculum formal-syntax composer applies the product family policy only when using the default formal grammar. Custom grammar callers keep raw sampler behavior by default, and callers can explicitly override or disable rule ordering.

## Contract

1. Formal grammar remains the legality source of truth.
2. Sampling taxonomy and probability live outside `src/syntax` grammar definitions.
3. Adding or splitting a controlled production requires an explicit taxonomy update.
4. Kind and family weights belong to versioned curriculum policy.
5. Variant count must not silently change family probability.
6. Rule ordering may reorder but may not filter, duplicate, or replace eligible grammar productions.
7. Learner adaptation and construction recency are later policy layers; they do not legalize or invalidate grammar.

Run the diagnostic with:

```sh
npx tsx scripts/audit-formal-syntax-sampling.ts
```

It reports both the old equal-production ticket shares and the nominal product family priors. Realized frequencies can still differ because lexical reachability, derivation bounds, and failover are real constraints; those effective shares should be monitored separately rather than baked back into grammar.
