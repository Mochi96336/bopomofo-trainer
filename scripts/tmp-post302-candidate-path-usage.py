from pathlib import Path

path = Path("src/syntax/sample.ts")
text = path.read_text()

def once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one {label} anchor, found {count}")
    text = text.replace(old, new, 1)

once(
'''function nestedTargetKey(parentRuleId: string, constituentKey: string): string {
  return `${parentRuleId}\\u0000${constituentKey}`;
}

''',
'''function nestedTargetKey(parentRuleId: string, constituentKey: string): string {
  return `${parentRuleId}\\u0000${constituentKey}`;
}

const CANDIDATE_PATH_USAGE = {
  ruleChildrenCalls: 0,
  callsUsingSamplingPath: 0,
};

export function readCandidatePathUsage() {
  return { ...CANDIDATE_PATH_USAGE };
}

''',
"stats",
)

once(
'''): SampledRuleChildren | null {
  let workingState = inputState;
''',
'''): SampledRuleChildren | null {
  CANDIDATE_PATH_USAGE.ruleChildrenCalls += 1;
  let usedSamplingPath = false;
  let workingState = inputState;
''',
"rule children entry",
)

once(
'''        const slot = makeSlot(
          constituent,
          childRequirements,
          occurrenceIndex,
          extendSamplingPath(path, constituent.key),
        );
''',
'''        if (!usedSamplingPath) {
          usedSamplingPath = true;
          CANDIDATE_PATH_USAGE.callsUsingSamplingPath += 1;
        }
        const slot = makeSlot(
          constituent,
          childRequirements,
          occurrenceIndex,
          extendSamplingPath(path, constituent.key),
        );
''',
"lexical path use",
)

once(
'''      const requestedChildRuleId = target?.childRuleId;
      const child = sampleCategory(
''',
'''      const requestedChildRuleId = target?.childRuleId;
      if (!usedSamplingPath) {
        usedSamplingPath = true;
        CANDIDATE_PATH_USAGE.callsUsingSamplingPath += 1;
      }
      const child = sampleCategory(
''',
"recursive path use",
)

path.write_text(text)
