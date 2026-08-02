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

The sheet holds two kinds of row, and the `selection` column says which is
which. They are not interchangeable.

`--base` draws a plain uniform sample of the catalog. These are the `base` rows,
and the catalog rate is computed from them and from nothing else.

`--per-level` then guarantees a floor for every level of every stratum, because
the levels that carry the risk are exactly the ones a uniform sample would barely
touch. These are the `floor` rows. They exist to locate problems, never to
measure the catalog — see below for why they cannot do the second job.

The two sets are merged and de-duplicated, so the sheet is smaller than their
sum.

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
- `role_verdict` — see below; it needs a precise statement.

### What `role_verdict` is judging

The sheet shows what the entry was actually assigned, because a reviewer cannot
judge a role they were never told:

| Column | Meaning |
| --- | --- |
| `assigned_upos` | Every distinct UPOS tag assigned to this entry, `\|`-separated |
| `assigned_frames` | Every distinct valency frame assigned to it |
| `profile_count` | How many runtime syntax profiles it has |

Most entries have one profile, but 1,983 of them carry more than one distinct
UPOS and a few carry six. So the question has to be asked at the level of the
entry rather than of a profile:

> **`role_verdict` is `wrong` if any assigned UPOS or frame is one this word does
> not have.** It is `ok` only when every assignment listed is defensible.

That is the product-relevant question rather than the convenient one. The runtime
composes utterances from these profiles, so a single wrong assignment on an entry
is enough to put that word in a slot it does not belong in — whether or not its
other assignments are right.

The consequence is that the reported rate is "share of entries carrying at least
one wrong role assignment", not "share of assignments that are wrong". An entry
with six profiles has more chance to fail than one with a single profile;
`profile_count` is on the sheet so that can be looked at rather than guessed.

`unsure` is a real answer and should be used. A reviewer forced to guess produces
a number that reads as measurement and is not one. `notes` is free text; use it
whenever `wrong` needs an explanation to be actionable.

Review both columns for every row, even when one is obviously fine. Skipping the
easy ones biases the denominator.

## Scoring

```bash
npm run qa:catalog-score -- data/qa/catalog-sample.csv
```

Scoring refuses to run unless the sheet still matches the `.meta.json` drawn with
it. The digest covers every column except the verdicts and notes, so pairing a
sheet with the wrong metadata, or sorting the rows in a spreadsheet and saving,
is reported rather than silently scored against rows that are no longer the ones
that were drawn.

Reading and grammar role are reported apart and are never combined. They fail
for different reasons and are fixed in different places, and a single number
covering both would hide whichever is healthier behind whichever is not.

Two things come out, and only one of them is a measurement.

**The catalog rate** is counted over the `base` rows alone, with a 95% interval
beside it. Those rows are a uniform sample, so the count needs no weighting and
carries no selection bias. This is the number to quote.

**The per-stratum rates** answer where a problem sits. Each level is counted over
the base rows plus the rows *that stratum's own floor* reached for, with a sample
size and an interval.

Rows drawn only by a different stratum's floor are left out of that count. They
are on the sheet for being rare somewhere else, and rarity is assumed to travel
with error, so counting them here would raise whichever level of this stratum
they happen to sit in. Against a population where the fault was confined to one
stratum, counting every row put two innocent strata at 6.1% when their true rate
was around 1.3% — outside the interval the correct count gives. A diagnostic that
points at the wrong data source is worse than none.

Base membership and within-level floor membership are both decided by shuffle
rank alone, which is independent of anything a review will find, so their union
is still a uniform sample of the level.

### Why the floor rows cannot be reweighted into an estimate

It is tempting to take each level's rate and weight it by that level's share of
the catalog. That does not work here, and an earlier version of this tool did it
anyway.

Whether a floor row was drawn depends on **all six strata at once**. So inside
any one level, the floor rows over-represent whatever is rare on the other five
dimensions — and if error tracks rarity, which is the entire hypothesis, their
rate is inflated. Weighting by one dimension's catalog shares cannot undo a bias
the other five introduced.

Measured against a uniform reference sample under an error model correlated
across dimensions, that reweighting overstated a true 21.3% rate as anywhere from
22.3% to 29.5% depending on which dimension it weighted by — six mutually
inconsistent answers, with nothing to say which was the real one. Counting the
base rows gave 23.0%, inside its own confidence interval.

## Recording a result

The drawn sheet is committed unfilled and gains its verdicts in place, so the
diff of a review pull request is exactly the judgements that were made. Keep the
`.meta.json` beside it: the digests in that file are what tie the result to a
specific catalog state, and a rate without the catalog digest it was measured on
cannot be compared with anything.

When a new baseline is drawn — after an expansion, or with a new seed — copy the
finished sheet and its metadata aside under a dated name before overwriting them,
so the comparison has something to compare against. Drawing over a sheet that
already holds verdicts is refused unless `--force` is passed, so forgetting this
costs a message rather than the review.

## What this is not

It does not gate CI, and it should not. Sampling QA answers "how wrong is the
data", which is a question with a number for an answer and a judgement about
whether that number is acceptable. Wiring it to a threshold would turn a
judgement into a build failure and, worse, create pressure to review in whatever
way keeps the build green.

It also introduces no semantic model at runtime. Everything here is a review
protocol over data that already shipped.
