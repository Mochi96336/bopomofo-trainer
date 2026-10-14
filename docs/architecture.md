# Architecture

## Current product first

This repository is a browser Bopomofo typing trainer with a substantial archived research history. The production path is intentionally smaller than the repository as a whole.

```text
browser / app
    ↓
product session + local progress
    ↓
commonness-level catalog filter
    ↓
formal-syntax utterance selection
    ↓
InteractionSessionV2
    ↓
Measurement V2
    ↓
ProductProgress + PilotHistory + ProgressHistory
    ↓
Analysis V2 / diagnostics
```

The browser has no backend, account system, telemetry, or cloud learner state. Product state remains local and schema-versioned.

## Current production modules

```text
src/app/                 Browser UI, keyboard input, persistence integration, Analysis V2
src/product/             Product session, progress, Pilot history, product coordination
src/commonness/          Commonness levels and product catalog access
src/curriculum/          Current utterance selector plus legacy curriculum/research compatibility
src/syntax/              Formal syntax derivation, runtime profiles, legality checks
src/practice/            InteractionSessionV2 and normalized input traces
src/measurement-v2/      Current measurement aggregation and serialization
src/progress-history/    Bounded per-key observation history
src/diagnostics/         Pure user-facing measurement projections
src/catalog/             Reviewed catalog parsing/validation/compilation support
src/scheme/              Bopomofo tokens and physical layouts
```

The main maintenance rule is that current browser behavior must be understandable from these modules without requiring the archived relational research stack.

## Product selection boundary

The browser selects complete grammar-valid utterances from the practice catalog after commonness-level filtering.

```text
reviewed practice catalog
        +
runtime syntax profiles
        +
Measurement V2 binding evidence
        +
frequency-first recency state
        ↓
selectFormalSyntaxUtterance(...)
        ↓
one deterministic seeded grammar-valid utterance
```

Current production selection uses reviewed commonness, expected-token correctness, identifiable binding timing, and recent-entry / recent-utterance penalties. It does not use legacy motor-transition scoring: the formal-syntax production entry point explicitly supplies no legacy transition evidence.

The browser does not reserve a held-out evaluation catalog and does not schedule automatic evaluation rounds. Build output currently encodes an empty evaluation catalog; remaining evaluation types and parser branches are compatibility debt, not active product behavior.

## Syntax boundary

Formal syntax determines which derivations and lexical realizations are legal. Selection cannot bypass that boundary to obtain a better learner score.

The runtime ships only profiles admitted by the current formal-syntax allowlist. A stale or digest-mismatched allowlist fails compilation. The selector fails closed if no complete `Sentence` derivation can be realized; it does not fall back to arbitrary word lists.

Word meaning and world knowledge are outside the formal architecture boundary. Catalog and syntax tooling may use form, pronunciation, frequency, morphosyntactic tags, dependency evidence, surface distribution, valency, and declared formal production rules, but must not silently substitute semantic plausibility judgments for explicit evidence.

## Measurement and persistence boundary

Current browser interaction uses `InteractionSessionV2` and Measurement V2. A completed practice round:

1. derives Measurement V2 observations from accepted browser traces;
2. updates cumulative Measurement V2 aggregates;
3. updates frequency-first selection recency;
4. appends bounded recent summaries, Pilot history, and progress-history observations;
5. persists the schema-versioned local state.

Product progress is currently schema 7 with measurement epoch `coordination-v1`. Schema 6 is accepted only as a migration boundary: incompatible legacy measurement-derived evidence is cleared before entering the current epoch.

The old curriculum envelope is still physically present in `ProductProgress`, but most of it no longer controls product selection. The exact retirement boundary is tracked in [Repo consolidation inventory](./repo-consolidation-inventory.md).

## Analysis boundary

Analysis V2 is a projection over current measurements and bounded progress history. It does not alter selection or learner state.

Although the current Analysis V2 semantic builder receives `CurriculumProfile`, it only uses the duplicated `mode` and `layoutId` fields to address Measurement V2 binding aggregates. It does not depend on legacy focus/cooldown decisions. This dependency is therefore a consolidation target rather than a reason to keep the full legacy curriculum model in production progress.

## Data-generation boundary

Source import, lexicon generation, reading projection, syntax evidence, and runtime-profile compilation remain review-gated build-time work. External sources do not automatically mutate the reviewed browser catalog.

```text
source bytes
  → source-specific projection / audit
  → generated candidate evidence
  → explicit review
  → reviewed catalog / runtime syntax data
  → compact browser artifact
```

Only reviewed product artifacts reach the browser bundle.

## Archived research architecture

The repository also preserves the earlier relational research stack:

```text
reference
relations / partition
composition
simulation
integration
relational experiment + confirmation harnesses
legacy measurement / curriculum paths
```

Those modules remain reproducible research evidence. They may model held-out evaluation partitions, relation-targeted objectives, variable-length composition, synthetic learners, hidden truth, and strategy comparisons, but none of those systems decides what the current website asks a learner to type.

Archived research should remain callable through explicit research entry points. It should not force current product types, persistence, CI, or root exports to pretend those concepts are still browser features.

## Dependency rules

1. Product selection must consume only current product evidence contracts.
2. Formal syntax legality is checked before learner weighting.
3. Measurement code does not know which selection strategy produced the exercise.
4. Diagnostics and Analysis V2 are read-only projections.
5. External-source generation cannot automatically approve catalog content.
6. Archived research may depend on its own legacy abstractions; current product code should not depend on them unless a documented migration boundary requires it.
7. Compatibility parsing belongs at persistence/import boundaries, not in the normal runtime model.
8. Simulation evidence cannot be presented as proof of real learning effectiveness.

## CI boundary

General pull-request CI currently protects more than `npm run check`: it includes syntax source-evidence audits, Formal Syntax Phase 1 closure and product-baseline verification, the product/build checks, bundle budget, and browser smoke tests.

Archived relational research has a separate manual `check:research` path, but legacy simulation tests still run in the ordinary product check. CI separation is therefore incomplete and remains a consolidation task.

## Deferred product work

- human pilot validation with non-developers;
- broader reviewed lexicon expansion after bundle runway is restored;
- evidence-driven sentence-variety refinement;
- any new recall/evaluation design, if human evidence justifies one;
- alternate layouts;
- accounts, cloud sync, or telemetry;
- claims about real learning effectiveness.

Formal Syntax Phase 2 should not be treated as the automatic next product milestone merely because Phase 1 is complete.
