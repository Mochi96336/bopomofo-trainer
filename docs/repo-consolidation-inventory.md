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

## 3. Transition scoring boundary

The shared frequency-first implementation still contains legacy transition score fields and compatibility APIs. Current production is narrower:

- `product/session.ts` calls `selectFormalSyntaxUtterance(...)`.
- that entry point scopes Measurement V2 binding evidence;
- it explicitly supplies `legacyTransitions: null`;
- product tests assert neutral transition output: boost `1`, empty trace.

Therefore exact motor-transition timing is **not current product selection evidence**. It remains useful for diagnostics / research and legacy selector tests, but active product documentation must not describe it as a browser weighting signal.

A later code split should make the compile-time boundary match the runtime boundary so the production selector no longer imports or exposes legacy transition machinery except through an isolated compatibility layer.

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

### P1c — split current and legacy frequency-first selectors

The production formal-syntax selector should compile without legacy Measurement V1 / transition / template dependencies. Archived tests and research can import a separate compatibility selector.

### P1d — bundle attribution before lexicon growth

The current bundle is already near its budget. Attribute bytes among catalog entries, runtime syntax profiles, grammar/runtime tables, Analysis V2, and app code before accepting another broad lexicon expansion.

### P2 — physical archive and CI boundary

Move archived research out of the active mental surface, reduce root exports, and stop legacy simulation from gating unrelated browser/UI changes once equivalent research verification remains available manually.

## Stop condition

Repo consolidation is complete when a new maintainer can understand the browser product without learning the archived relational research architecture first, while historical experiments and old local backups remain reproducible/readable through explicit boundaries.
