# 東西: exact same-UPOS reading-versus-sense review

## Why this experiment exists

#413 verified that the two complete headword identities 東西 / ㄉㄨㄥ1-ㄒㄧ1
(direction) and 東西 / ㄉㄨㄥ1-ㄒㄧ5 (objects) have distinct dictionary
sense families. That is **headword-level evidence**, not approval of any
generated sentence.

The active 2026-10-16 runtime syntax profiles for the two readings project
the **same NOUN functions and aggregate dependency counts** from surface-level
UD data. They therefore cannot by themselves decide which reading fits a
generated context. This is different from the #414 種 experiment, whose
limited verb/noun roles had separable evidence. Do **not** add an arbitrary
NOUN-only filter or automatically mark a generated example as correct.

## Diagnostic, not a new product reading policy

1. Reuse the exact 2,048-seed, shipping reviewed-role audit without resetting
   its seed namespace.
2. Count examples of **both exact whole-word IDs** independently, even if a
   reading has zero unbiased exposure. Do not require both to appear under one
   UPOS in a bounded sample.
3. Use independent deterministic, *heavily biased* lexical probes for each
   reading (default: 24 seeds per ID), solely to obtain inspection examples.
4. Carry the selected entry identity, selected UPOS/function, profile identity,
   root construction, adjacent lexical entries, sentence and seed into a
   balanced small **pending** context review queue.
5. Show whether the two profiles are structurally indistinguishable after
   excluding catalog/profile IDs; never mistake this for equal semantics.
6. Separate human judgments:
   - **sentence naturalness:** can the generated utterance be interpreted
     as idiomatic Mandarin?
   - **contextual sense:** directions, objects, ambiguous or indeterminate?
   - **contextual reading:** does the selected reading fit the independently
     judged sense?
   These are NOT derived from the chosen entry ID.
7. Never promote generated examples to training labels or formal rules.

## Reproduce

    npm run app:catalog
    npm run readings:audit -- --policy reviewed-roles --output data/generated/polyphonic-context-reviewed-roles.json
    npx tsx scripts/audit-dongxi-context.ts --samples-per-reading 24

Output: data/generated/dongxi-context-review.json (gitignored). The
polyphonic-reading-exposure Actions workflow also retains it.

Two authored illustrations already exist in the #412 hypotheses:
「街道呈東西走向」 and 「我買了一些東西」. Their four review decisions
remain **pending** in committed evidence, and they are not allowed to
substitute for an independently adjudicated hold-out set.

## Decisions to make after review

- If generated examples are largely unnatural, prioritize lexical/semantic
  compatibility in the composer before training a pronunciation model.
- If independent natural sentences differ reliably by contextual words or
  constructions, evaluate evidence-backed features and an **abstaining**
  lightweight classifier offline on real reviewed contexts.
- If candidate features fail, only then investigate a compact neural
  contextual model. Never treat teacher predictions as ground truth.
- Before any product activation: retain separately documented rare-sense
  practice coverage, zero unlicensed changes, same-seed regressions,
  browser asset-size budget and device latency.

CI passing here proves only **traceability** and no unintended product change,
not human correctness of the example sentences.
