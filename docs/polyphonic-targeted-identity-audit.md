# Polyphonic reading identities: targeted coverage audit

Follow-up to [issue #405](https://github.com/Mochi96336/bopomofo-trainer/issues/405)
and the unbiased exposure audit (#395 / #404). The goal is **identify missing
evidence**, not to assign a reading to a new sentence or change the shipped
trainer.

## Three independent questions

1. **Is the exact (text, reading) identity in the packaged practice catalog?**
   Here only written forms with 2+ active reading IDs are probed.
2. **Does this reading identity have any licensed runtime UPOS profile?**
   A profile is surface-keyed grammar evidence, not proof that the reading can
   actually play that role in a natural Mandarin sentence.
3. **Does the existing generator select it?**
   First measure the existing 2,048 unbiased deterministic seeds. Then, for
   identities not seen, deliberately increase only that reading's selection
   weight in a finite, reproducible research-only run. This is an existence
   *probe*, not representative production sampling.

A profile accepted by a reading policy does not guarantee that it can appear
in a complete derivation. A finite targeted run that never selects the target
likewise cannot prove structural impossibility.

## Repeat

```bash
npm run app:catalog
npm run readings:audit -- --policy reviewed-roles \
  --output data/generated/polyphonic-context-reviewed-roles.json
npx tsx scripts/audit-targeted-polyphonic-identities.ts --probes 3

# For a quick/debug run only; reports from --max-targets are incomplete:
npx tsx scripts/audit-targeted-polyphonic-identities.ts \
  --probes 1 --max-targets 10
```

Output: `data/generated/polyphonic-targeted-identity-coverage.json`.

Each row contains the original exact reading-specific entry ID, all licensed
syntax profile IDs / UPOS, baseline occurrence count, and either selected
target contexts with role and neighbors or an explicit bounded miss count.

Statuses are *not* interchangeable:

| Status | Actual conclusion |
|---|---|
| `observed-in-unbiased-sample` | Existing 2,048-seed product-family sampling selected the reading |
| `observed-only-in-targeted-probe` | A biased, research-only sampler selected the reading at least once |
| `not-observed-after-bounded-probes` | Still uncertain; might be very hard to reach, rejected in a later slot or absent from sampled construction shapes |
| `all-profiles-role-rejected` | No listed runtime profile is permitted by the currently reviewed reading gate; does **not** erase this dictionary reading |
| `no-runtime-profile` | The active syntax catalog has no profile for this reading identity |
| `not-probed` | Coverage was intentionally partial, or a run did not include this identity |

## Performance and quality controls

- A fixed seed is derived from the exact reading ID and attempt number, so
  each target is reproducible.
- The default is 3 independent, bounded product-family attempts for each
  identity absent from the unbiased baseline. These are **not proof of
  unreachable grammar**.
- The target receives an intentionally huge selection weight *only inside
  this CLI*, not in any product, curriculum, or progress artifact. The
  shipped catalog, scoring and storage are unchanged.
- Candidate sentences are diagnostic. Even one successfully forced context
  may use the wrong word sense, wrong syntactic category, or unnatural
  collocation. **Do not promote biased sentences as reading ground truth.**
- If generated contexts cannot establish a correct lexical sense, obtain
  independent native/corpus sentence evidence or mark the case uncertain.

## Next action

Combine this per-reading coverage with the #404 same-UPOS review queue and
select examples for manual review. Separate the annotation fields for
pronunciation, lexical sense, syntax profile, and utterance naturalness.
The only legitimate route to a trained small classifier is a *held-out,
human-reviewed* validation set; g2pW output can suggest candidates but is
not an authoritative label.
