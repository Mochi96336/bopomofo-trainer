# Commonness levels and how rarer words are earned

## Product decision

The catalog carries four displayed commonness levels, cut by share of the
packaged catalog: the most common tenth, then up to a quarter, then up to a
half, then the rest. `src/commonness/tiers.ts` derives the cut points from the
weights actually shipped, and the practice stage already reads a sentence's
rarest level beside the round status.

A fresh learner practises the most common level only. The rarer levels are
earned, and once earned they can be switched on and off from the 稀有度 row in
the information panel. At least one level is always practised.

This is the only place where commonness gates eligibility. Inside the practised
levels selection is unchanged: commonness stays one continuous weight, and a
rarer word is selected less often rather than locked out. See
[selection policy](./frequency-first-utterance-policy.md).

## Unlock condition

A level opens on **keyboard breadth**: how many of the layout's keys have
accumulated enough clean inputs.

```text
practised key      = a binding whose (attempts − errors) reaches 8
level 2 (流行)     = 20 practised keys
level 3 (尋常)     = 27 practised keys
level 4 (罕見)     = 33 practised keys
```

Breadth rather than practice volume, because rarer words are built out of the
rarer letters: a learner who has never typed ㄘ or ㄖ has no way to meet the
vocabulary a wider pool would draw from. Errors do not count towards a key, so
accuracy shortens the road without a separate accuracy bar to state.

The bars were placed against a simulated flawless learner on the shipped
catalog, which is the fastest anyone can reach them: 20 keys near the 34th
sentence, 27 near the 60th, 33 near the 120th. The last bar stays below 36
because the most common tenth of the catalog alone cannot practise every key —
ㄦ and ㄆ barely occur in it — and a bar the unlocked pool cannot reach would be
a permanent lock rather than a level.

## Why the unlocked set is derived, not stored

Clean inputs only ever accumulate, so the count is monotone and an earned level
can never be taken back. That is what allows the unlocked set to be computed
from the measurements the product already persists: there is no high-water mark
to keep in sync with progress, importing a backup carries the levels with the
progress it belongs to, and clearing progress honestly clears the levels.

What is stored is the learner's wish: which levels they want practised, kept
wider than the unlocked set. A level they never switched off joins practice on
the round it unlocks; a level they switched off stays off when a later one
opens. The practised set is that wish narrowed to the unlocked levels, and never
empty.

## Hidden review shortcuts

`F9` opens every level for the current page and toggles back off again. It
writes nothing — measurements, unlock progress and the level preference are
untouched, and a reload returns to what was actually earned. While it is on the
count in the panel is prefixed `檢視用開放`, so open marks cannot be mistaken for
earned ones. The preference still applies: a level switched off stays off.

`F10` finishes the current sentence. Unlike `F8`, this records a real round, so
it inflates accuracy and moves the practised-key counters. Every input is
preceded by an unmapped guard input, which is the interaction-noise case the
measurement policy already excludes timing for, so a machine typing at machine
speed cannot leave 0 ms best times behind.

## Boundaries

- The evaluation catalog is never narrowed. It is the fixed yardstick, and
  filtering it by a practice preference would make its readings mean different
  things at different settings.
- Syntax profiles are filtered alongside the practice entries, because the
  product environment rejects a profile pointing at an entry it does not have.
- An entry with no reviewed frequency evidence has no level to be filtered by,
  so it stays in every setting rather than being dropped by all of them.
- Stored progress, Pilot history and backups are validated against the whole
  catalog. Their records point at entries drawn before the learner narrowed the
  levels, and reading them through the narrowed catalog would reject that
  history as invalid.
- Every level on its own supports all 42 layout keys, so no setting can leave a
  key unpractisable. `tests/product/real-catalog.test.ts` asserts this against
  the shipped catalog.
