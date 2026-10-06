import { parse } from 'acorn';
import { transformSync } from 'esbuild';

/** Find reads of screen props, excluding JSX text, property names, types and callback-local names. */
export function reactBindingReads(body: string): Set<string> {
  const code = transformSync(`function screen() { ${body} }`, { loader: 'tsx', jsx: 'transform' }).code;
  const tree = parse(code, { ecmaVersion: 'latest', sourceType: 'module' });
  const reads = new Set<string>();
  const bind = (node: any, scope: Set<string>) => {
    if (!node) return;
    if (node.type === 'Identifier') scope.add(node.name);
    else if (node.type === 'ObjectPattern') node.properties.forEach((item: any) => bind(item.type === 'RestElement' ? item.argument : item.value, scope));
    else if (node.type === 'ArrayPattern') node.elements.forEach((item: any) => bind(item, scope));
    else if (node.type === 'AssignmentPattern') bind(node.left, scope);
    else if (node.type === 'RestElement') bind(node.argument, scope);
  };
  const walk = (node: any, scopes: Set<string>[], parent?: any, key?: string) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Identifier') {
      if (parent && ((['MemberExpression', 'Property', 'MethodDefinition'].includes(parent.type) && key === (parent.type === 'MemberExpression' ? 'property' : 'key') && !parent.computed)
        || key === 'id' || key === 'label')) return;
      if (!scopes.some(scope => scope.has(node.name))) reads.add(node.name);
      return;
    }
    if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) {
      const scope = new Set<string>(); bind(node.id, scope); node.params.forEach((param: any) => bind(param, scope));
      const nested = [...scopes, scope];
      node.params.forEach((param: any) => walk(param, nested)); walk(node.body, nested); return;
    }
    if (node.type === 'BlockStatement' || node.type === 'Program') {
      const scope = new Set<string>();
      for (const statement of node.body) {
        if (statement.type === 'VariableDeclaration') statement.declarations.forEach((item: any) => bind(item.id, scope));
        else if (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') bind(statement.id, scope);
      }
      node.body.forEach((statement: any) => walk(statement, [...scopes, scope])); return;
    }
    for (const [childKey, child] of Object.entries(node)) {
      if (Array.isArray(child)) child.forEach(item => walk(item, scopes, node, childKey));
      else if (child && typeof child === 'object') walk(child, scopes, node, childKey);
    }
  };
  walk(tree, []);
  return reads;
}
