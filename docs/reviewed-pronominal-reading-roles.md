# Reviewed pronominal reading roles: evidence and product activation

This began as a **role-scoped experiment**, not a general polyphonic Mandarin
pronunciation classifier. Following the scoped CI verification, production uses
these reviewed roles through the optional selector callback. The underlying
experiment and audits are retained for reproducibility.

## Why role-scoped evidence matters

The pinned 2,048-seed baseline included:

| Text / chosen grammatical role | Exposure | Out-of-role readings |
|---|---:|---:|
| 哪 / PRON | 68 | ㄋㄜ2 (18), ㄋㄚ5 (11) |
| 那 / DET | 31 | ㄋㄚ1 (15), ㄋㄨㄛ2 (7), ㄋㄚ3 (5) |
| 那 / PRON | 115 | **Not adjudicated** |

The source UD lexical profiles are keyed by **written text**, so all readings
inherit the same syntax profiles, without proof that a given pronunciation has
the given function.

## Explicit reviewed evidence

- **哪 as an interrogative PRON:** allow ㄋㄚ3 / ㄋㄟ3, identical to
  the existing reviewed question-construction readings.
  [MOE revised dictionary — 哪](https://dict.revised.moe.edu.tw/dictView.jsp?ID=2931)
  distinguishes interrogative pronouns from the neutral-tone particle and
  the specialized sound in 哪吒.
- **那 as a demonstrative DET:** allow ㄋㄚ4. This is a narrowly scoped
  contemporary demonstrative determiner trial.
  [MOE revised dictionary — 那](https://dict.revised.moe.edu.tw/dictView.jsp?ID=2930)
  also records ㄋㄚ3 as an interrogative *pronoun* and ㄋㄨㄛ2 in
  historical/literary contexts. This trial deliberately does **not** override
  那 / PRON, does not delete any catalogue identities, and does not infer
  global disallowance for the historical use cases.

An unreviewed role is **not** automatically treated as incorrect. Future
work will need genuine context/sense distinctions inside a single UPOS:
那 / PRON is a key counterexample to crude POS-only decision rules.

## Reproducible comparison

```bash
npm run app:catalog
npm run readings:audit -- --output data/generated/polyphonic-context-exposure.json
npm run readings:audit -- --policy reviewed-closed --output data/generated/polyphonic-context-reviewed-closed.json
npm run readings:audit -- --policy reviewed-roles --output data/generated/polyphonic-context-reviewed-roles.json
npx tsx scripts/compare-polyphonic-role-trial.ts \
  data/generated/polyphonic-context-exposure.json \
  data/generated/polyphonic-context-reviewed-closed.json \
  data/generated/polyphonic-context-reviewed-roles.json \
  data/generated/polyphonic-role-trial-comparison.json
```

The comparison verifies success for all pinned seeds, no disallowed
written-form/UPOS/reading identity in reviewed positions, and the **true
number of seed-level changes** to sentence text, selected entry IDs, or
sentence root. It exposes both affected and unaffected rows; merely having
fewer multi-reading characters is not an accuracy score.

## Not claimed / next research

- No online AI model, BERT, or backend. Production now applies only the
  reviewed role restrictions; unreviewed word senses remain unchanged.
- This is neither a reviewed accuracy percentage for every generated sentence
  nor a solution to semantically bizarre phrase combinations.
- A model trained on artificial examples should not be trusted without held-out
  native usage evidence. Review grammatical functions, collocations, and
  genuine contextual sentence examples before introducing sense classifiers.
- Future candidate: separate surface-keyed UD evidence from **per-reading**
  lexical/sense evidence, then project the latter onto permitted profile slots.
