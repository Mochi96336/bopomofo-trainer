# Natural-source context first; pronunciation second; weakness weighting last

Research Draft dependent on #425. **No production changes. No merging or
activating this candidate pool automatically.**

## Stage 1 — Traceable text, independently reviewable target readings

The 11 records in `data/research/attested-polyphonic-context-candidates.json`
are copied from actual UD Chinese GSD sentence texts. They carry the
original `split` and `sent_id`, a verbatim complete sentence, a small
local span, the target character, a *provisionally manually assigned*
pronunciation and one expected tone token.

The exact source blobs are pinned in the JSON:
- train `9aec4ae103fb5b7218f637afd686caf3b587a8e6`
- dev `8b967948097a2e4bebe7f5d0e053c4fed4fe3baa`
- test `3b15be45a96edcb21736f220e73fdccade231ca5`

Corpus: [UD Chinese GSD](https://github.com/UniversalDependencies/UD_Chinese-GSD),
CC BY-SA 4.0. Corpus text is evidence that people used a string,
**not** an independently adjudicated phonetic annotation: UPOS can be
incorrect for reading determination. All eleven entries have
`selectionEligible:false` and
`reviewStatus:pending-independent-reading-review`.

Provisional contrasts include `好` ㄏㄠ3 in positive adjective contexts
versus ㄏㄠ4 in `愛好` / `喜好`; `行` ㄏㄤ2 for lines of verse versus
ㄒㄧㄥ2 in `一行人` / `行軍`; and `種` ㄓㄨㄥ3 for kinds/species
versus ㄓㄨㄥ4 in `種植`. A word's UD UPOS alone is insufficient to
authorize any reading. `給` lacks an adequate attested contrast in this
small set and must not be advertised as a tested heteronym.

Before promoting a record, independently check its intended character
offset, word segmentation, complete-context sense, official dictionary
pronunciation, exact source text, and license, and mark review status.
A second reader's blinded review should precede use in learner-facing
exercises. Keep each train/dev/test split fixed.

## Stage 2 — Isolated, reusable candidate-first weighted picker

`scripts/prototype-attested-candidate-weighting.ts` uses the existing
`scoreFrequencyFirstEntry` and `weightedPick` machinery to score
**fixed-sound, source-traceable focal-character candidates**, rather than
sampling a possibly wrong sound and correcting it afterward.

Four safeguards:
- Only original TRAIN-split records enter the demonstration; DEV/TEST are
  held out for later unseen-context evaluation.
- Exactly the same 512 deterministic seeds are used for each cohort.
- Each selected item retains its immutable ID, original sentence, focus
  reading and tone; weighting never writes or changes the reading.
- Pending independent review makes the entire run **simulation-only**.
  The scorer is a focal-character proxy; it does **not** score the whole
  sentence's full Zhuyin transcript or naturalness.

The fixed simulated cohorts are: no weakness, 12 mistakes in 16 attempts
for tone 3, and 12 mistakes in 16 attempts for tone 4. We report how
often **correctly annotated focus tones** are selected. We do **not**
describe this as measured human improvement or full curriculum efficacy.

Run:

```sh
npm ci
npm run app:catalog
npx tsx scripts/prototype-attested-candidate-weighting.ts data/generated/attested-selection.json
```

## Actual decision gate before implementation

A production architecture could first assemble a *pool* of confirmed
natural sentences with complete reading annotations, then increase the
selection probability of sentences containing target weak Zhuyin.
But this prototype cannot be promoted until independent review of the
11 source-to-reading labels and whole-sentence G2P is complete, the
human-natural corpus has enough distinct candidate sentences, and
evaluation on held-out unseen contexts passes.

This keeps the user's core requirements separate: **natural text
attestation, objectively correct contextual readings, and actual
weak-target practice exposure**.
