import type { ProductionRule } from "./types.js";

/**
 * Guard the subset of the v1 IR that the derivation executor actually runs.
 * Structural construction identity belongs to production rules; required
 * features are lexical licenses and therefore may appear only on Lexeme
 * constituents until an explicit structural-feature evaluator exists.
 */
export function assertExecutableGrammarContract(rules: readonly ProductionRule[]): void {
  for (const rule of rules) {
    const bindingCounts = new Map<string, number>();
    for (const constituent of rule.constituents) {
      if (constituent.category !== "Lexeme"
        && Object.keys(constituent.requiredFeatures).length > 0) {
        throw new Error(
          `formal rule ${rule.id}:${constituent.key} carries non-executable structural features`,
        );
      }
      if (constituent.formalLiteral !== undefined) {
        if (constituent.category !== "Lexeme"
          || constituent.allowedUpos.length !== 1
          || constituent.allowedUpos[0] !== "PUNCT"
          || constituent.formalLiteral.length === 0
          || constituent.entryBinding !== undefined
          || Object.keys(constituent.requiredFeatures).length > 0
          || constituent.requiredFunctions.length > 0
          || constituent.requiredValencyFrames.length > 0) {
          throw new Error(
            `formal rule ${rule.id}:${constituent.key} has an invalid formal literal terminal`,
          );
        }
      }
      if (constituent.entryBinding === undefined) continue;
      if (constituent.category !== "Lexeme"
        || constituent.entryBinding.length === 0
        || constituent.minimum !== 1
        || constituent.maximum !== 1
        || constituent.formalLiteral !== undefined) {
        throw new Error(
          `formal rule ${rule.id}:${constituent.key} has an invalid lexical entry binding`,
        );
      }
      bindingCounts.set(
        constituent.entryBinding,
        (bindingCounts.get(constituent.entryBinding) ?? 0) + 1,
      );
    }
    for (const [binding, count] of bindingCounts) {
      if (count < 2) {
        throw new Error(`formal rule ${rule.id} has singleton lexical entry binding ${binding}`);
      }
    }
  }
}
