import { readFileSync, writeFileSync } from "node:fs";

const typesPath = "src/grammar/types.ts";
const composerPath = "src/curriculum/formal-syntax-utterance.ts";

let types = readFileSync(typesPath, "utf8");
const typeNeedle = "  readonly syntaxProfileIds?: readonly string[];\n";
if (!types.includes(typeNeedle)) {
  throw new Error("grammar candidate diagnostic insertion point not found");
}
types = types.replace(typeNeedle, `${typeNeedle}  /** Temporary audit-only structural trace; never land this field. */\n  readonly syntaxProductionRulePath?: readonly string[];\n  /** Temporary audit-only lexical requirement trace; never land this field. */\n  readonly syntaxLexicalSlots?: readonly {\n    readonly constituentKey: string;\n    readonly requiredFeatures: Readonly<Record<string, string>>;\n  }[];\n  /** Temporary audit-only successful-attempt marking intent; absent before the ticket exists. */\n  readonly syntaxPredicateMarkingPracticeIntent?: \"ordinary\" | \"negation\";\n`);
writeFileSync(typesPath, types);

let composer = readFileSync(composerPath, "utf8");
const composerNeedle = "      syntaxProfileIds: realization.syntaxProfileIds,\n";
if (!composer.includes(composerNeedle)) {
  throw new Error("formal composer diagnostic insertion point not found");
}
const hasTicketIntent = composer.includes("const requiresNegationPractice =");
const extra = [
  "      syntaxProductionRulePath: shape.productionRulePath,",
  "      syntaxLexicalSlots: shape.lexicalSlots.map((slot) => ({",
  "        constituentKey: slot.constituentKey,",
  "        requiredFeatures: slot.requiredFeatures,",
  "      })),",
  ...(hasTicketIntent
    ? ["      syntaxPredicateMarkingPracticeIntent: requiresNegationPractice ? \"negation\" : \"ordinary\","]
    : []),
  "",
].join("\n");
composer = composer.replace(composerNeedle, `${composerNeedle}${extra}`);
writeFileSync(composerPath, composer);

console.error(JSON.stringify({ patched: true, hasTicketIntent }));
