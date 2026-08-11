import type {
  StructuralDerivationShape,
  StructuralElement,
  StructuralLexicalSlot,
  StructuralSyntaxNode,
} from "./derive.js";

export type StructuralCompatibilityRelation =
  | "nsubj"
  | "csubj"
  | "obj"
  | "iobj"
  | "ccomp"
  | "xcomp";

export interface StructuralCompatibilityEdge {
  readonly headSlotId: string;
  readonly dependentSlotId: string;
  readonly relation: StructuralCompatibilityRelation;
}

const DIRECT_NOUN_SUBJECT_RULES = new Set([
  "clause.object-content",
  "clause.quoted-content",
]);

const HEAD_CHILD_CATEGORY_PRIORITY = [
  "Predicate",
  "VerbPhrase",
  "AdjectivePhrase",
  "NounPhrase",
  "NominalHead",
] as const;

function syntaxChildren(node: StructuralSyntaxNode): readonly StructuralSyntaxNode[] {
  return node.children.filter((child): child is StructuralSyntaxNode => child.kind === "syntax-node");
}

function directHeadSlot(node: StructuralSyntaxNode): StructuralLexicalSlot | null {
  const heads = node.children.filter(
    (child): child is StructuralLexicalSlot => child.kind === "lexical-slot" && child.constituentKey === "head",
  );
  return heads.length === 1 ? heads[0]! : null;
}

function clausePredicateHead(node: StructuralSyntaxNode): StructuralLexicalSlot | null {
  if (node.category !== "Clause" && node.category !== "OpenClause") return null;
  const children = syntaxChildren(node);
  for (const category of HEAD_CHILD_CATEGORY_PRIORITY) {
    const candidates = children.filter((child) => child.category === category);
    if (candidates.length !== 1) continue;
    const head = lexicalHead(candidates[0]!);
    if (head !== null) return head;
  }
  return null;
}

/**
 * Resolve the lexical head of a structural subtree only when the existing tree
 * makes that head unambiguous. Missing/ambiguous heads are neutral: compatibility
 * evidence must never become a new syntax-legality gate.
 */
export function lexicalHead(
  element: StructuralElement,
): StructuralLexicalSlot | null {
  if (element.kind === "lexical-slot") return element;
  if (element.category === "Clause" || element.category === "OpenClause") {
    return clausePredicateHead(element);
  }

  const direct = directHeadSlot(element);
  if (direct !== null) return direct;

  const children = syntaxChildren(element);
  const preferredCategories = element.category === "ContentClause" || element.category === "QuotedClause"
    ? ["Clause"]
    : element.category === "Subject"
        || element.category === "Object"
        || element.category === "IndirectObject"
        || element.category === "DisposalPatient"
        || element.category === "PassiveAgent"
      ? ["NounPhrase"]
      : element.category === "NounPhrase"
        ? ["NominalHead"]
        : [];
  for (const category of preferredCategories) {
    const candidates = children.filter((child) => child.category === category);
    if (candidates.length !== 1) continue;
    const head = lexicalHead(candidates[0]!);
    if (head !== null) return head;
  }
  return null;
}

function edge(
  head: StructuralLexicalSlot | null,
  dependent: StructuralLexicalSlot | null,
  relation: StructuralCompatibilityRelation,
): StructuralCompatibilityEdge | null {
  if (head === null || dependent === null || head.id === dependent.id) return null;
  return { headSlotId: head.id, dependentSlotId: dependent.id, relation };
}

function clauseEdges(node: StructuralSyntaxNode): readonly StructuralCompatibilityEdge[] {
  if (node.category !== "Clause" && node.category !== "OpenClause") return [];
  const predicate = clausePredicateHead(node);
  if (predicate === null) return [];

  const result: StructuralCompatibilityEdge[] = [];
  for (const child of syntaxChildren(node)) {
    let relation: StructuralCompatibilityRelation | null = null;
    switch (child.category) {
      case "Subject":
        relation = "nsubj";
        break;
      case "Object":
        relation = "obj";
        break;
      case "IndirectObject":
        relation = "iobj";
        break;
      case "ContentClause":
        relation = node.productionRuleId === "clause.subject-content" ? "csubj" : "ccomp";
        break;
      case "QuotedClause":
        relation = "ccomp";
        break;
      case "OpenClause":
        relation = "xcomp";
        break;
      case "NounPhrase":
        if (DIRECT_NOUN_SUBJECT_RULES.has(node.productionRuleId)) relation = "nsubj";
        break;
      default:
        break;
    }
    if (relation === null) continue;
    const candidate = edge(predicate, lexicalHead(child), relation);
    if (candidate !== null) result.push(candidate);
  }
  return result;
}

/**
 * Project a structural derivation into dependency-shaped lexical pairs used only
 * for soft corpus compatibility scoring. These edges do not participate in
 * derivation validity, lexical profile matching, or grammar identity.
 */
export function collectStructuralCompatibilityEdges(
  shape: StructuralDerivationShape,
): readonly StructuralCompatibilityEdge[] {
  const result: StructuralCompatibilityEdge[] = [];
  const seen = new Set<string>();

  const visit = (node: StructuralSyntaxNode): void => {
    for (const candidate of clauseEdges(node)) {
      const key = `${candidate.headSlotId}\u0000${candidate.dependentSlotId}\u0000${candidate.relation}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(candidate);
      }
    }
    for (const child of syntaxChildren(node)) visit(child);
  };

  visit(shape.root);
  return result;
}
