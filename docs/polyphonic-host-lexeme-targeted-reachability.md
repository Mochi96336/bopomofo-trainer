# Targeted whole-lexeme reachability after #415

#415 established that the exact 2,048-seed **unbiased** reviewed-role
corpus selected the atomic 遊說 entry **zero** times even though it had a
catalog reading identity and a runtime syntax profile. This does not prove
that the grammar cannot select it: a rare word can have low unconditional
sampling probability.

This experiment reuses the existing generator's optional *research-only*
lexical weight callback, just as the existing targeted-polyphone-identity
probe does. It differs because 遊說 is a one-reading complete compound,
not a multi-reading written form, so the polyphonic-targeted queue cannot
test it directly.

## Baseline and treatment

The input must be #415's polyphonic-lexeme-boundary-readiness-v1 diagnostic
from exactly 2,048 reviewed-role seeds. Source cases come from the committed
MOE headword-sense evidence; example host lexemes remain **illustrations
of compound attestation, not reviewed correct generated sentence labels**.

For each host (遊說, 自給自足, 成為), check:

- Is the **exact whole-word** identity in the active catalog?
- Does it have a runtime syntactic profile licensed by current reviewed-role
  constraints? Profile presence only makes a probe meaningful, not successful.
- If eligible, run up to 16 deterministic product-family seeds with
  a **biased lexical weight of 100,000,000** for exact whole-word entries.
- Record selection of exact entry IDs, matching runtime profile IDs,
  candidate generation failures, and any rendered-string matches that
  accidentally arise from other lexical entries.
- Preserve a few actual generated sentence examples as **unreviewed output**,
  never as automatically approved reading labels.

The reported status "not-observed-after-bounded-biased-probes" **does not
mean unreachable**, and even an observed valid lexical ID does **not prove**
that the sentence is idiomatic, semantically correct, or representative
of normal product sampling.

## Reproduce

    npm run app:catalog
    npm run readings:audit -- --policy reviewed-roles --output data/generated/polyphonic-context-reviewed-roles.json
    npx tsx scripts/audit-lexeme-boundary-readiness.ts
    npx tsx scripts/probe-whole-lexeme-reachability.ts --probes 16

The final gitignored report is
data/generated/polyphonic-host-lexeme-reachability.json.

CI retains this artifact. Nothing changes product catalog identities,
production weights, syntax definitions, learner progress, or shipped assets.

## Follow-up interpretation

- If 遊說 can be selected under bias, insufficient exposure is the more
  plausible reason for zero baseline hits; inspect output naturalness
  independently before introducing selection restrictions.
- If not, inspect slot and structural rule compatibility with the licensed
  VERB profile; avoid calling 16 missed seeds an impossibility proof.
- Missing host lexemes (自給自足, 成為) need independent catalog/source and
  grammar-evidence work before a host-based reading rule is possible.
- 東西 needs sense-context adjudication of *one full word with two readings*;
  it is not solved by this host-probe or by using POS alone.
