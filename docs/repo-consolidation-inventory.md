# Repo consolidation inventory

Status baseline: `main@438142694002f799d40778119742f47010b6925a`.

This document separates current browser behavior from compatibility baggage and archived research before any retirement PR changes runtime code.

## Classification

- **Current product**: required to choose, run, measure, persist, or display a normal browser practice round.
- **Migration boundary**: not produced by the current browser, but still intentionally accepted while loading older stored/exported data.
- **Archived research**: reproducible experiment infrastructure that is not part of browser behavior.
- **Retirement candidate**: state or API shape that current product no longer needs once compatibility is isolated.

## 1. Evaluation product shell — retired in PR #390

The current browser runtime is now practice-only:

- `ProductCatalogs` contains `practice` plus syntax profiles only;
- `ProductEnvironment` has one `practiceSupport` index;
- `ProductRound.kind` and the active `ProductRoundSummary` are compile-time `"practice"`;
- commonness narrowing filters that one practice catalog;
- `scripts/compile-app-catalog.ts` no longer emits or exports an empty evaluation catalog.

The retired `"evaluation"` tag remains only in explicitly historical types and progress / Pilot-history parsing so older local data can still be validated. Legacy Pilot entry IDs must resolve in the current complete practice catalog.

This closes P1a. A future evaluation feature, if human evidence ever justifies one, should be designed against the current Measurement V2 model rather than reviving the old product shell.

## 2. Legacy curriculum state inside ProductProgress — retired in schema 8

Current `ProductProgress` no longer stores `CurriculumProfile`, `curriculumPolicyVersion`, focus/cooldown state, duplicated binding aggregates, `lastFocusedRound`, or `recentTokenIds`.

The one product behavior that was still hidden inside that envelope — `recentEntryIds` for repetition penalty — now belongs to `FrequencyFirstSelectionState` beside recent utterance and template IDs.

Analysis V2 already receives `mode` and `layoutId` directly from `ProductProgress`, so it has no curriculum dependency.

Migration boundaries are explicit:

- schema 8: current runtime format;
- schema 7: preserve Measurement V2 and recent summaries, move `curriculum.recentEntryIds` into selection state, discard dead curriculum fields;
- schema 6: preserve identity/round/selection recency, but reset incompatible strict-order measurements and recent summaries;
- schemas 1–5: rejected.

This closes P1b: legacy curriculum remains available to archived research/simulation modules, but is no longer product runtime or persistence state.

## 3. Transition scoring boundary — split in P1c

Current production and legacy transition selection now have separate modules:

- `frequency-first-utterance.ts`: current product policy, binding evidence, grammar generation, selection recency, formal-syntax selection;
- `legacy-frequency-first-utterance.ts`: archived Measurement V1 adapter and canonical token-pair transition scoring.

The production selector imports no `src/measurement/` module and exposes no transition score/trace fields. `product/session.ts` imports only the current module. A source-boundary test locks both conditions in CI.

Legacy/research callers can still reproduce historical transition-aware weighting through the explicit compatibility module without making those semantics part of the browser product.

## 4. Documentation mismatches fixed by the first consolidation PR

Before this inventory, active docs had four misleading edges:

1. the frequency-first policy said transition timing affected production selection;
2. the same policy described product progress as schema 6 even though current code is schema 7;
3. `docs/architecture.md` led with the archived relational research pipeline and only later described the current browser;
4. README described `npm run check` as if it were the whole PR contract even though CI adds syntax evidence audits, Phase 1 closure/baseline checks, and browser tests.

The first consolidation PR changes documentation only.

## 5. Work sequence after documentation alignment

### P1a — retire evaluation from the runtime model — done in PR #390

### P1b — retire legacy curriculum from ProductProgress — done in schema 8

`recentEntryIds` now belongs to frequency-first selection state, Analysis V2 is independent of `CurriculumProfile`, and schemas 7/6 migrate through explicit compatibility paths.

### P1c — split current and legacy frequency-first selectors — done

The production selector now compiles without legacy Measurement V1 / transition dependencies. Archived template/transition tests import the explicit legacy compatibility module.

### P1d — bundle attribution before lexicon growth — done

The baseline at `main@9bf4c599476ce38c4f50b004cc587f6db86dae79` is now reproducible with `npm run size:attribution`.

- production JS: 467.3 kB gzip / 2,193.4 kB raw;
- generated catalog: 87.0% of Rollup rendered module bytes;
- formal syntax / selection: 5.3%;
- product runtime: 3.0%;
- app shell: 2.3%;
- Analysis V2: 2.3%;
- practice-entry payload: 304.1 kB isolated gzip / 1,479.2 kB raw;
- runtime syntax-profile payload plus compact dictionaries: 94.5 kB isolated gzip / 487.8 kB raw.

The practical conclusion is that future broad lexicon growth must account for both entry payload and syntax-profile payload. Analysis V2 is not the dominant bundle cost. Full measurement notes live in `docs/bundle-attribution.md`.

### P2a — split top-level entrypoints — done

The source root is now intentionally three-way:

- `src/index.ts`: current browser/product runtime only;
- `src/tooling.ts`: active catalog, reference, and syntax build/review APIs;
- `src/research.ts`: archived Measurement V1, relations, legacy curriculum/selector, composition, simulation, and relational integration.

A product boundary test prevents archived research exports from leaking back into the default root or browser session.

### P2b — physical archive — in progress

The first low-risk batch is physically archived under `src/archive/research/`:

- relational research integration;
- legacy transition-aware frequency-first selector;
- legacy slot-weighted/template grammar.

Their research scripts/tests now import the archived paths explicitly, while `src/research.ts` remains the stable opt-in research entrypoint. A source-boundary test prevents active runtime trees from importing `src/archive/research/**`.

Relations and the broader simulation tree are intentionally not moved yet because current reference/ranking tooling still imports relational report types. Those dependencies should be separated before the next physical archive batch.

### P2c — CI boundary — done

Ordinary `check:pr` and GitHub product CI no longer execute `tests/simulation/**`. Focused simulation remains available through `npm run test:simulation`, while manual `npm run check:research` begins with full `npm test` and therefore retains simulation coverage before the relational research pipeline runs.

This removes archived simulation latency from unrelated browser/UI/product changes without deleting or weakening the research verification path.

## Stop condition

Repo consolidation is complete when a new maintainer can understand the browser product without learning the archived relational research architecture first, while historical experiments and old local backups remain reproducible/readable through explicit boundaries.
