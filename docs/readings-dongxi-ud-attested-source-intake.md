# UD Chinese GSD 東西 examples: provenance and licensing

**Status:** source-attested examples, not independently reviewed correct
pronunciation labels. No production usage, product assets, model training or
accuracy reporting.

## Origin

- Corpus: https://github.com/UniversalDependencies/UD_Chinese-GSD
- Immutable upstream commit: 22f73e87f7ddc530bb131a6b7587971a03e1a712
- Files: zh_gsd-ud-train.conllu, zh_gsd-ud-dev.conllu, zh_gsd-ud-test.conllu
- Treebank contributors: Mo Shen, Ryan McDonald, Daniel Zeman, Peng Qi.
- Text genre: Wikipedia-derived.
- Upstream treebank and annotation license: Creative Commons
  Attribution-ShareAlike 4.0 International (CC BY-SA 4.0).
- Full license: https://creativecommons.org/licenses/by-sa/4.0/legalcode
- Original license notice: https://github.com/UniversalDependencies/UD_Chinese-GSD/blob/22f73e87f7ddc530bb131a6b7587971a03e1a712/LICENSE.txt

Upstream cautions that the UD annotation copyright and permission from
Google do not imply ownership of the original sentence text. The research
fixture is **not MIT-licensed simply because the repository is MIT**;
preserve applicable source-text copyright, attribution and CC BY-SA
share-alike conditions in any downstream reuse. The exact source sentence
texts are stored separately from authored preliminary sense proposals.

## What we actually observed

- 10 independently annotated whole-word 東西 tokens: 6 train, 3 dev,
  1 test (exact source sentence IDs and source token indices retained).
- Preliminary researcher triage, still pending independent adjudication:
  5 direction-related and 5 object-related contexts.
- train-s816 is a deliberately excluded negative control: the source token
  is 東西向, not an independent 東西 entry.
- Every source 東西 token is NOUN; the supplied transliteration dōngxi does
  not reliably distinguish full first tone from neutral tone.

## Review and evaluation boundary

Each sentence needs independent checks for tokenization, contextual sense,
correct pronunciation and sentence naturalness, with no automatic promotion
from UD token or preliminary hypothesis to ground truth.

There is only ONE test example (objects), while all THREE dev examples are
directions. Combined 5/5 *hypothesis* counts do not produce a representative
held-out benchmark. Training and accuracy claims remain blocked.

Reproduce the fail-closed integrity check:

    npx tsx scripts/audit-dongxi-ud-intake.ts
    npx vitest run tests/readings/dongxi-ud-intake.test.ts

The CI report is a count-only summary, not a dataset of approved labels.
Do not activate a product reading policy, model, or altered sampling weights
based on this intake.
