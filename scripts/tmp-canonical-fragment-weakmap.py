from pathlib import Path

path = Path("src/syntax/sample.ts")
text = path.read_text()

old = '''const DETERMINISTIC_MINIMUM_RANDOM: RandomSource = { next: () => 0 };


function canonicalFeatureSetJson(features: SyntaxFeatureSet): string {
  const fields = Object.keys(features)
    .filter((key) => features[key as SyntaxFeatureName] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${JSON.stringify(features[key as SyntaxFeatureName])}`);
  return `{${fields.join(",")}}`;
}

function canonicalStringArrayJson(values: readonly string[]): string {
  return JSON.stringify(values);
}
'''
new = '''const DETERMINISTIC_MINIMUM_RANDOM: RandomSource = { next: () => 0 };

const canonicalFeatureSetJsonCache = new WeakMap<SyntaxFeatureSet, string>();
const canonicalStringArrayJsonCache = new WeakMap<readonly string[], string>();
const childrenCanonicalJsonCache = new WeakMap<readonly string[], string>();

function canonicalFeatureSetJson(features: SyntaxFeatureSet): string {
  const cached = canonicalFeatureSetJsonCache.get(features);
  if (cached !== undefined) return cached;
  const fields = Object.keys(features)
    .filter((key) => features[key as SyntaxFeatureName] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${JSON.stringify(features[key as SyntaxFeatureName])}`);
  const canonical = `{${fields.join(",")}}`;
  canonicalFeatureSetJsonCache.set(features, canonical);
  return canonical;
}

function canonicalStringArrayJson(values: readonly string[]): string {
  const cached = canonicalStringArrayJsonCache.get(values);
  if (cached !== undefined) return cached;
  const canonical = JSON.stringify(values);
  canonicalStringArrayJsonCache.set(values, canonical);
  return canonical;
}
'''
if old not in text:
    raise SystemExit("canonical helper block not found")
text = text.replace(old, new, 1)

old = '''function childrenCanonicalJson(childCanonicalSources: readonly string[]): string {
  return `[${childCanonicalSources.join(",")}]`;
}
'''
new = '''function childrenCanonicalJson(childCanonicalSources: readonly string[]): string {
  const cached = childrenCanonicalJsonCache.get(childCanonicalSources);
  if (cached !== undefined) return cached;
  const canonical = `[${childCanonicalSources.join(",")}]`;
  childrenCanonicalJsonCache.set(childCanonicalSources, canonical);
  return canonical;
}
'''
if old not in text:
    raise SystemExit("children canonical helper not found")
text = text.replace(old, new, 1)

path.write_text(text)
