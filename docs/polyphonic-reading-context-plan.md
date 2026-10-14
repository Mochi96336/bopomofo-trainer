# Polyphonic reading contexts: evidence-first plan

## Scope

The catalog intentionally stores separate `(text, reading)` identities. Keep
every entry and its stable ID: a reading is *known to exist* independently from
whether it is appropriate for a particular generated sentence.

Current formal-syntax lexical profile projection is surface-keyed. Multiple
readings of the same surface can therefore share UPOS, functions, and
dependency evidence. Some closed constructions are already protected by
`CONSTRUCTION_READINGS`; these protections are not a general semantic
disambiguator.

A read-only exposure audit comes before any restrictive change:

```bash
npm run app:catalog
npm run readings:audit
# Optional quick smoke test:
npm run readings:audit -- --samples 100
```

The report is written to
`data/generated/polyphonic-context-exposure.json` (gitignored). It contains
the observed sentence, chosen catalog entry ID, alternative reading IDs,
immediate lexical neighbors, syntax root, deterministic seed index, and counts
of ambiguous texts seen or missed in the sample.

The default 2,048 samples reuse the phase-one product baseline's seed
namespace, bounds, and composer settings. **This is a grammar-generation
exposure audit, not a replay of user histories or proof of pronunciation
errors.** The 2,048 samples may not cover every reading; unseen words remain
explicitly listed. A suspected error needs contextual review.

## Reading eligibility boundary (implemented for reviewed roles)

The selector now passes the existing reviewed role gate through formal-syntax
selection to lexical realization. It keeps the originally drawn entry whenever
that entry is permitted, and redraws only after a documented role mismatch.
The gate does not redefine syntax legality or rewrite a persisted catalog
entry ID. Broader sense and lexical-collocation validation remains future work.

- Exact reviewed lexical readings and existing licensed constructions win.
- For ambiguous readings, evidence can include reviewed phrases, syntactic
  construction usage, or reviewed contextual collocations.
- An unknown reading-in-context remains **unreviewed**, not **incorrect**.
- The active gate rejects only a reading disallowed by a *reviewed* role. It
  then resamples from licensed entries without inventing a pronunciation.
- Ensure legitimate rare readings remain usable through evidenced contexts or
  a separately designed targeted practice route. Avoid a blind global ban.
- Keep measuring rejections, candidate exhaustion, coverage, and distribution
  drift against the pinned baseline as new role evidence is added.

Suggested review artifact fields are: text, exact catalog entry ID, permitted
context or construction, evidence source, review status, and stable version.
Neither a bare UPOS match nor shared text-level commonness should establish
permission for a specific reading.

## Model decision: only after measuring evidence coverage

g2pW is a *teacher candidate* for offline corpus annotation and disagreement
mining, **not** a production dependency in the browser. Evaluate its Taiwanese
Mandarin readings against an independently reviewed hold-out set, including
heteronyms with less frequent senses. Teacher predictions alone must not be
labeled ground truth.

If reviewed phrases plus lexical/context features are insufficient, train a
small per-text classifier (e.g. sparse contextual features + regularized
linear classification) and compare it to a tiny encoder **before** proposing
quantization of a full BERT model. A small vocabulary can reduce classifier
heads, but not the underlying pretrained encoder automatically.

Measure:
1. Accuracy/error rate on *accepted* reviewed examples and abstention rate.
2. Coverage by individual ambiguous written form and reading.
3. Generated sentence success rate, retries, family distribution, and reading
   exposure, before/after the gate.
4. Serialized browser asset size and warm/cold device latency if a model is
   eventually shipped.

Only enforce rules or ship a classifier if it improves reviewed context
correctness without breaking practice coverage and production performance.
