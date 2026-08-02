# Catalog sampling QA

Every entry in the shipped catalog has passed formal validation: the reading
parses into legal syllables, the entry satisfies the syntax legality gate, and a
grammar profile exists for it. None of that says the reading is the one a reader
would give the word, or that the grammatical role is the one the word has.

Those are judgements. The only way to know the rate at which they are wrong is
to look at a sample and count. This is how that is done, and how the result is
recorded so the next expansion can be compared against it.

## Why it exists

`docs/roadmap.md` accepts two known, unmeasured error sources: grammar roles
assigned directly from stable UD evidence, and CC-CEDICT heteronyms activating
each distinct reading as its own entry. "Unmeasured" is the operative word. A
catalog that grows without a baseline can only ever report the error rate it has
after growing, with no way to tell what the new batch contributed.

So the baseline is drawn **before** the next expansion, not after it.

## Drawing a sample

```bash
npm run qa:catalog-sample
```

Writes `data/qa/catalog-sample.csv` — the review sheet — and
`data/qa/catalog-sample.meta.json` beside it. The sheet is UTF-8 with a BOM so a
spreadsheet reads the Chinese rather than the system code page.

The draw is deterministic by seed, so the same catalog and seed always produce
the same rows: a sample nobody can reproduce cannot be reviewed in a pull
request, and one drawn afresh each run cannot be compared with the last.

```bash
npm run qa:catalog-sample -- --seed 2026-q3 --base 300 --per-level 40
```

`--base` draws proportionally, so the headline describes the catalog as shipped.
`--per-level` then guarantees a floor for every level of every stratum, because
the levels that carry the risk are exactly the ones a proportional sample would
barely touch. The two sets are merged and de-duplicated, so the sheet is smaller
than their sum.

## The strata

| Stratum | Levels | What it separates |
| --- | --- | --- |
| `readingSupport` | `moe-concised`, `moe-revised-fallback`, `manual-override`, `projection-disagrees`, `no-projection` | Which committed source, if any, carries the shipped reading |
| `heteronym` | `single-reading`, `multi-reading` | Whether the catalog ships more than one reading for the text |
| `cedict` | `unique-record`, `ambiguous-records`, `absent` | What CC-CEDICT says about the text's identity |
| `commonness` | `tier-1` … `tier-4` | The frequency band the learner meets it in |
| `grammarEvidence` | `none`, `weak-1-2`, `moderate-3-9`, `strong-10-plus` | How many observed dependencies stand behind the role |
| `predicate` | `predicate`, `non-predicate`, `no-frame` | Whether the entry can head a clause |

`projection-disagrees` and `no-projection` are deliberately separate. A word no
committed source covers is a gap; a word a committed source covers *differently*
is an override, and those are not the same risk.

## Reviewing

Fill in two columns per row, each `ok`, `wrong` or `unsure`:

- `reading_verdict` — is this the reading this word has, in this written form?
- `role_verdict` — is the grammatical role the entry was given the role it has?

`unsure` is a real answer and should be used. A reviewer forced to guess produces
a number that reads as measurement and is not one. `notes` is free text; use it
whenever `wrong` needs an explanation to be actionable.

Review both columns for every row, even when one is obviously fine. Skipping the
easy ones biases the denominator.

## Scoring

```bash
npm run qa:catalog-score -- data/qa/catalog-sample.csv
```

Reading and grammar role are reported apart and are never combined. They fail
for different reasons and are fixed in different places, and a single number
covering both would hide whichever is healthier behind whichever is not.

Two figures per stratum:

- the **rate within each level**, which is what tells you where the problem is;
- a **catalog estimate**, which reweights those rates by how much of the catalog
  each level actually covers.

Quote the catalog estimate, never the raw `overall` row. The sample over-draws
small strata on purpose, so its unweighted rate is a property of the sheet rather
than of the catalog.

## Recording a result

The drawn sheet is committed unfilled and gains its verdicts in place, so the
diff of a review pull request is exactly the judgements that were made. Keep the
`.meta.json` beside it: the digests in that file are what tie the result to a
specific catalog state, and a rate without the catalog digest it was measured on
cannot be compared with anything.

When a new baseline is drawn — after an expansion, or with a new seed — copy the
finished sheet and its metadata aside under a dated name before overwriting them,
so the comparison has something to compare against.

## What this is not

It does not gate CI, and it should not. Sampling QA answers "how wrong is the
data", which is a question with a number for an answer and a judgement about
whether that number is acceptable. Wiring it to a threshold would turn a
judgement into a build failure and, worse, create pressure to review in whatever
way keeps the build green.

It also introduces no semantic model at runtime. Everything here is a review
protocol over data that already shipped.
