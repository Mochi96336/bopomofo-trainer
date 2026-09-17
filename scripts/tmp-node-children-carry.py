from pathlib import Path

path = Path("src/syntax/sample.ts")
text = path.read_text()

old = '''function syntaxNodeIdentityCanonicalJson(
  category: SyntaxCategory,
  productionRuleId: string,
  surfaceOrderId: string,
  childCanonicalSources: readonly string[],
): string {
  return `{"category":${JSON.stringify(category)},"children":${childrenCanonicalJson(childCanonicalSources)},"productionRuleId":${JSON.stringify(productionRuleId)},"surfaceOrderId":${JSON.stringify(surfaceOrderId)}}`;
}

function syntaxNodeCanonicalJson(
  node: StructuralSyntaxNode,
  childCanonicalSources: readonly string[],
): string {
  return `{"category":${JSON.stringify(node.category)},"children":${childrenCanonicalJson(childCanonicalSources)},"id":${JSON.stringify(node.id)},"kind":"syntax-node","productionRuleId":${JSON.stringify(node.productionRuleId)},"surfaceOrderId":${JSON.stringify(node.surfaceOrderId)}}`;
}
'''
new = '''function syntaxNodeIdentityCanonicalJson(
  category: SyntaxCategory,
  productionRuleId: string,
  surfaceOrderId: string,
  childrenCanonicalSource: string,
): string {
  return `{"category":${JSON.stringify(category)},"children":${childrenCanonicalSource},"productionRuleId":${JSON.stringify(productionRuleId)},"surfaceOrderId":${JSON.stringify(surfaceOrderId)}}`;
}

function syntaxNodeCanonicalJson(
  node: StructuralSyntaxNode,
  childrenCanonicalSource: string,
): string {
  return `{"category":${JSON.stringify(node.category)},"children":${childrenCanonicalSource},"id":${JSON.stringify(node.id)},"kind":"syntax-node","productionRuleId":${JSON.stringify(node.productionRuleId)},"surfaceOrderId":${JSON.stringify(node.surfaceOrderId)}}`;
}
'''
if old not in text:
    raise SystemExit("syntax node canonical block not found")
text = text.replace(old, new, 1)

old = '''    const identitySource = syntaxNodeIdentityCanonicalJson(
      category,
      rule.id,
      order.id,
      sampledChildren.childCanonicalSources,
    );
'''
new = '''    const childrenCanonicalSource = childrenCanonicalJson(sampledChildren.childCanonicalSources);
    const identitySource = syntaxNodeIdentityCanonicalJson(
      category,
      rule.id,
      order.id,
      childrenCanonicalSource,
    );
'''
if old not in text:
    raise SystemExit("syntax node identity call not found")
text = text.replace(old, new, 1)

old = '''      canonicalSource: syntaxNodeCanonicalJson(node, sampledChildren.childCanonicalSources),
'''
new = '''      canonicalSource: syntaxNodeCanonicalJson(node, childrenCanonicalSource),
'''
if old not in text:
    raise SystemExit("syntax node canonical call not found")
text = text.replace(old, new, 1)

path.write_text(text)
