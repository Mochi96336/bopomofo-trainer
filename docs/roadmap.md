# Roadmap

This records what is built, what is being worked on now, and the boundaries that must not be crossed. Completed work is summarized rather than replayed phase by phase; the detail lives in the contract documents and in Git history.

## Built

**Foundation.** Semantic Bopomofo tokens, physical layouts, guided/recall modes, catalog entries and exercises; explicit tones, legal syllable parsing, provenance, and catalog validation; a validated Taiwan Standard input path covering first-tone Space, boundaries, errors, recovery, and raw trace semantics.

**Measurement.** Deterministic binding, confusion, and transition observations with explicit boundary, recovery, and noise exclusions. See [measurement policy](./measurement-policy.md).

**Grammar-valid candidates.** Complete syntax coverage for the active catalog, reviewed lexical roles and predicate valency, and a formal production grammar that constrains every practice utterance. Missing, duplicate, inconsistent, or unprovenanced grammar metadata fails the build. See [formal syntax](./formal-syntax-system.md).

**Frequency-first selection.** Reviewed commonness sets the base weight; expected-token error and accepted binding timing add capped, explainable boosts; recent entries, utterances, and templates are penalized. Selection is deterministic under a seed. See [selection policy](./frequency-first-utterance-policy.md).

**Earned commonness levels.** Practice starts at the most common level; rarer levels open on how much of the keyboard has been practised cleanly, and unlocked levels can be switched on and off. See [commonness levels](./commonness-levels.md).

**Local-first product.** Schema-versioned progress, Pilot history, and bounded progress-trend history in localStorage, with backup export/import and explicit deletion of obsolete generations. Nothing leaves the browser.

**Weakness diagnostics.** A full-page analysis over binding, transition, and confusion aggregates, plus bounded per-key progress trends. See [weakness diagnostics](./weakness-diagnostics.md) and [progress history](./diagnostic-progress-history.md).

**Relational research (archived).** Catalog analysis, reference importing with manual review, relation-preserving partitions, variable-length composers, synthetic learners, a four-axis strategy matrix, and factorial experiments through candidate confirmation. **Neither candidate survived confirmation**; nothing was promoted to production. The harnesses remain reproducible under `docs/archive/` as evidence, not as a planned path.

## Now

### Reviewed lexicon expansion

The active catalog is the automated-only NAER lexicon: 13,897 syntax-legal practice entries, 0 syntax exclusions.

Review rigor deliberately changed partway through this work. Early waves reviewed every candidate by hand. Later waves traded manual grammar review for growth speed: grammar roles are assigned directly from stable UD evidence, and CC-CEDICT heteronyms are activated with every distinct reading as its own entry rather than picking one. Both carry an accepted, unmeasured error rate. Ordinary identity and reading resolution still fails closed on ambiguity; only grammar classification and explicit heteronym inclusion are looser.

Measuring that rate is what [catalog sampling QA](./catalog-sampling-qa.md) is for. The baseline is drawn before the next expansion rather than after it, so a later measurement can say what the new batch contributed instead of only what the whole catalog looks like afterwards. Two exposures it already quantifies without any review having happened: 22.1% of entries ship a reading no committed MOE projection covers, and 73.9% of entries carry at least one grammar role resting on only one or two observed dependencies.

### Local human pilot

Short repeatable guided-mode sessions recording task completion, wrong-key recovery, IME friction, hint usage, and repetition complaints. Accuracy and latency are observations, not a mastery score.

**First session run 2026-07-31, by the developer.** No blocking friction was reported: the default flow was completed without intervention, and none of the manual protocol steps produced a failure the operator noticed.

Instrumented checks alongside that session covered what a person reading the screen cannot verify. The page loads with no runtime console error — worth checking directly, because at the time no test could import the shell at all and a failure there would not show up in a green suite. (That gap is closed: the shell is now built by `createApp` in `src/app/create-app.ts` and is driven directly in `tests/app/app-shell.test.ts`.) The next utterance was reproduced identically across two reloads, and `Escape` opened and closed the information panel with focus returning to the capture target.

Those checks also found one defect the manual pass did not: at a 320px viewport that scrolls vertically, only 305px of content width remains, so the 320px floor on `html` and `body` produced 15px of horizontal scrolling against interface rule 12. The floor is now 300px, which is what the layout actually needs.

Still outstanding, and the reason this is not finished: the session was run by the developer, so the clause about completing the default flow *without developer assistance* cannot be self-certified, and a single session with no observed friction gives nothing to reproduce.

Exit condition: observed friction is reproducible across sessions, the default flow can be completed without developer assistance, and any proposed threshold or UI change cites a concrete pilot failure mode.

### After the pilot, and only then

- review stage thresholds against real pilot data;
- improve sentence variety without runtime LLM generation;
- consider recall mode and alternate layouts as separate measurement scopes.

## Guardrails

- Word meaning and semantics are forbidden inputs throughout catalog processing, grammar annotation, composition, selection, and validation. No definition, sense, semantic role, plausibility judgment, world knowledge, embedding, language model, or semantic proxy may filter, rank, repair, or reject a candidate. Only non-semantic form, frequency, and syntactic evidence may be used; unresolved cases retain every otherwise valid form or fail closed rather than being resolved by meaning.
- Frequency eligibility cannot be bypassed by a weakness score.
- Part of speech alone is insufficient; predicate frame remains explicit.
- Transitions never cross syllable or entry boundaries.
- Confusion remains diagnostic and never feeds selection, unless a future product decision explicitly changes that boundary.
- The actual wrong token never gains selection weight; only the expected token does.
- External reference candidates never enter the reviewed catalog automatically.
- Simulation does not prove human learning effectiveness.

## Out of scope

Accounts, backend, telemetry, cloud sync, mobile-specific interaction design, and any claim about real learning effectiveness.
