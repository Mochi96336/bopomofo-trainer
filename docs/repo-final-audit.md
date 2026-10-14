# Repo final audit

Audit start baseline: `main@3a3485b8610b2b3749c81c444bafd95f66a177f4`.

This audit checks whether the current browser product can be understood, built, tested, and maintained without accidentally depending on archived relational research infrastructure.

## Scope

At audit start the repository contained:

- 241 TypeScript source files under `src/`;
- 240 TypeScript test files under `tests/`;
- current browser/product runtime plus retained Measurement V1, relational, composition, and simulation research.

The audit reviewed source entrypoints, runtime import boundaries, persistence/measurement paths, CI gates, archived research consumers, suspicious low-consumer modules, and active documentation.

## Product/runtime boundary

The active browser/runtime trees have no import of:

- `src/measurement/**` (Measurement V1);
- `src/relations/**`;
- `src/composition/**`;
- `src/simulation/**`;
- `src/archive/research/**`.

The current path remains:

```text
browser/app
→ product session
→ formal-syntax frequency-first selection
→ InteractionSessionV2
→ Measurement V2
→ ProductProgress / PilotHistory / ProgressHistory
→ Analysis V2
```

A source-boundary test scans the active runtime trees and fails if archived research is imported back into them.

## Root entrypoints

Three explicit source surfaces remain:

```text
src/index.ts      current browser/product runtime
src/tooling.ts    active catalog/reference/syntax build and review tooling
src/research.ts   explicit archived research / compatibility surface
```

The audit found one leak: `src/index.ts` still exported the retired `practice/interaction-session.ts` V1 API even though production uses InteractionSessionV2. The cleanup corrects the root to export current practice input/plan/InteractionSessionV2 contracts and moves V1 session exposure to `src/research.ts`.

## Physical archive

Already archived before this audit:

- legacy transition-aware frequency-first selector;
- legacy slot-weighted/template grammar;
- relational research integration.

This audit additionally archives the relational objective contracts/strategy selector and the retired Phase 4 curriculum stack:

- relational objective contract and strategy selection;
- policy;
- state classification;
- focus selection;
- legacy exercise builder;
- simulator;
- scenarios;
- CLI.

These modules had no current product/tooling consumer. Their tests and research script remain intact through archived paths.

## CI boundary

Ordinary product CI no longer needs archived simulation as a merge gate.

The intended boundary is:

```text
ordinary PR
→ current source-evidence checks
→ typecheck
→ test:fast
→ source adapters
→ catalog validation
→ production build
→ bundle budget
→ browser smoke

research
→ test:simulation          (focused)
→ check:research
   → npm test              (full Vitest, includes simulation)
   → relational research pipeline
```

Research coverage is therefore retained without adding archived simulation latency to unrelated browser/product changes.

## Bundle ownership

The last explicit attribution baseline remains:

- production JS: 467.3 kB gzip / 2,193.4 kB raw;
- generated catalog: 87.0% of Rollup rendered module bytes;
- formal syntax / selection: 5.3%;
- product runtime: 3.0%;
- app shell: 2.3%;
- Analysis V2: 2.3%.

The dominant bundle risk is catalog payload growth, not Analysis V2.

## Dead-code review

No high-confidence production dead code was found.

Two suspicious areas were checked rather than deleted:

- `src/simulation-v2/input-order.ts` has only a test consumer, but that test validates a current Measurement V2 invariant: canonical, reverse, and other legal body-token orders must complete without invented semantic errors. It remains useful.
- formal-syntax practice/taxonomy helpers with few runtime consumers remain active evidence/audit infrastructure and are exercised by syntax tests/scripts.

Research modules with consumers are not classified as dead merely because they are outside browser production.

## Remaining intentional structural debt

The repository is not physically divided into one completely isolated archive tree.

In particular:

- `src/reference/contribution.ts` and `src/reference/ranking.ts` still consume relational report contracts;
- the broader `src/relations/**`, `src/composition/**`, and `src/simulation/**` research stack therefore remains in historical paths;
- `src/curriculum/types.ts` still contains shared current contracts alongside types retained by archived curriculum research; the executable relational objective and Phase 4 implementations themselves are now outside the current curriculum tree.

These are ownership/refactoring debts, not current browser coupling. Moving them wholesale would require changing active build/review tooling contracts and is not justified solely for directory aesthetics.

## Conclusion

The product-facing consolidation stop condition is satisfied.

A maintainer can now understand the browser product from the current entrypoint, product/session, formal syntax, InteractionSessionV2, Measurement V2, persistence, Analysis V2, and product CI without first learning the archived relational research architecture.

Further physical archive work should be opportunistic and evidence-driven. The next priority should return to product validation (including human pilots and pronunciation/context behavior), not continue structural cleanup for its own sake.
