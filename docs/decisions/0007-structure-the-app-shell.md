# ADR 0007: Structure the app shell instead of replacing it

## Status

Accepted

## Context

[ADR 0002](./0002-framework-independent-core.md) and [ADR 0006](./0006-interaction-spike-before-curriculum.md) introduced the browser layer as a disposable interaction spike: temporary code that would be replaced rather than evolved once a product UI framework was chosen. That premise has expired without ever being revisited.

The spike is now the product surface. It carries the practice loop, commonness unlocking, weakness diagnostics, progress trends, local-first persistence, and backup import and export. No framework was chosen, and nothing about the current work suggests one is needed.

What changed is the cost of leaving it unstructured:

- `src/app/main.ts` is 1,309 lines with 25 module-level mutable bindings; `product` alone is read or written in 56 places;
- every render function reads that ambient state rather than receiving it, so no function in the shell can be called from a test without constructing a DOM and running the module's whole initialization;
- `src/app/diagnostic-panel.ts` is 900 lines but holds no module state at all — it is long, not entangled, and the two problems should not be treated as one;
- the domain core beneath it is 175 small modules under 479 tests.

The untested surface is exactly the part a learner touches. The pilot in [the roadmap](../roadmap.md) is meant to produce evidence about that surface, and evidence is harder to act on when the code it describes cannot be exercised in isolation.

## Decision

The app shell stops being disposable. It is structured in place, and no UI framework is adopted to do it.

Testability comes from extraction, not from a component library. Three rules govern the work:

- pure derivation and markup move into their own modules and arrive with tests;
- module-level mutable bindings become explicit state records built by a factory that receives its effects — storage, timers, randomness — as arguments, so behavior can be driven from a test;
- `main.ts` keeps only DOM mounting, event binding, and render orchestration.

Every step is behavior-preserving and lands with `npm run check:pr` green. No new runtime dependency is added; the project has none and that stays true. The domain core is not touched — `src/product`, `src/curriculum`, and `src/syntax` are already small and tested.

The disposability clause of ADR 0002 and ADR 0006 no longer applies to the browser layer. Their framework-independence decision is unchanged and is the reason this work is possible without a rewrite.

## Consequences

Positive:

- the shell becomes reachable from tests, so pilot findings about it can be reproduced rather than only described;
- the extraction order can put the low-risk, stateless work first, because `diagnostic-panel.ts` and `main.ts` fail differently;
- effects arriving as arguments makes timer and storage behavior assertable, which today it is not;
- framework selection stays deferred, and stays cheap, because the domain core never depended on one.

Costs:

- a sequence of behavior-preserving changes produces no user-visible improvement while it runs;
- the largest state cluster, the practice session, has the widest blast radius and must be moved last, so the work gets harder rather than easier as it proceeds;
- explicit state records are more verbose at the call site than module-level bindings;
- line count is not the goal and should not be used to judge progress; the measure is how much of the shell a test can reach.
