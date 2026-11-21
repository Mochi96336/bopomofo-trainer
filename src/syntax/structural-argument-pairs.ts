import type {
  StructuralDerivationShape,
  StructuralElement,
  StructuralLexicalSlot,
  StructuralSyntaxNode,
} from "./derive.js";

/**
 * Candidate UD-style relations inferred from an explicitly identified clause
 * construction. These are grammar hypotheses, not attested UD dependencies.
 * A pair is absent whenever any head is ambiguous or the rule is outside the
 * narrow clause-model contract. Never train or hard-reject a reading from them.
 */
export interface StructuralArgumentPair {
  readonly headSlotId: string;
  readonly dependentSlotId: string;
  readonly relation: "nsubj" | "obj";
  readonly clauseRuleId: "clause.intransitive" | "clause.transitive" | "clause.ditransitive";
}

const SUPPORTED_CLAUSES = new Set([
  "clause.intransitive", "clause.transitive", "clause.ditransitive",
]);

function singleDirectPredicateHead(node: StructuralSyntaxNode): StructuralLexicalSlot | null {
  if (node.category !== "Predicate") return null;
  const heads = node.children.filter((child): child is StructuralLexicalSlot =>
    child.kind === "lexical-slot" && child.constituentKey === "head"
    && child.allowedUpos.length === 1 && child.allowedUpos[0] === "VERB",
  );
  return heads.length === 1 ? heads[0]! : null;
}

function singleArgumentHead(node: StructuralSyntaxNode): StructuralLexicalSlot | null {
  if (node.category !== "Subject" && node.category !== "Object") return null;
  const heads: StructuralLexicalSlot[] = [];
  // Only a nominal head under a single nominal phrase qualifies. A clausal
  // subject, coordination, embedded predicate or multi-head phrase abstains.
  function visit(current: StructuralSyntaxNode, insideNominalHead: boolean): void {
    if (current.category !== "Subject" && current.category !== "Object"
      && current.category !== "NounPhrase" && current.category !== "NominalHead") return;
    const inHead = insideNominalHead || current.category === "NominalHead";
    for (const child of current.children) {
      if (child.kind === "syntax-node") {
        visit(child, inHead);
      } else if (inHead && child.constituentKey === "head"
        && child.allowedUpos.length === 1
        && ["NOUN", "PRON", "PROPN"].includes(child.allowedUpos[0]!)) {
        heads.push(child);
      }
    }
  }
  visit(node, false);
  return heads.length === 1 ? heads[0]! : null;
}

function directChild(
  node: StructuralSyntaxNode,
  category: StructuralSyntaxNode["category"],
): StructuralSyntaxNode | null {
  const matching = node.children.filter((child): child is StructuralSyntaxNode =>
    child.kind === "syntax-node" && child.category === category);
  return matching.length === 1 ? matching[0]! : null;
}

export function extractStructuralArgumentPairs(
  shape: StructuralDerivationShape,
): readonly StructuralArgumentPair[] {
  const pairs: StructuralArgumentPair[] = [];
  const walk = (element: StructuralElement): void => {
    if (element.kind === "lexical-slot") return;
    if (element.category === "Clause" && SUPPORTED_CLAUSES.has(element.productionRuleId)) {
      const predicate = directChild(element, "Predicate");
      const head = predicate === null ? null : singleDirectPredicateHead(predicate);
      if (head !== null) {
        const subject = directChild(element, "Subject");
        const subjectHead = subject === null ? null : singleArgumentHead(subject);
        if (subjectHead !== null) {
          pairs.push({
            headSlotId: head.id, dependentSlotId: subjectHead.id, relation: "nsubj",
            clauseRuleId: element.productionRuleId as StructuralArgumentPair["clauseRuleId"],
          });
        }
        if (element.productionRuleId !== "clause.intransitive") {
          const object = directChild(element, "Object");
          const objectHead = object === null ? null : singleArgumentHead(object);
          if (objectHead !== null) {
            pairs.push({
              headSlotId: head.id, dependentSlotId: objectHead.id, relation: "obj",
              clauseRuleId: element.productionRuleId as StructuralArgumentPair["clauseRuleId"],
            });
          }
        }
      }
    }
    for (const child of element.children) walk(child);
  };
  walk(shape.root);
  return pairs;
}
