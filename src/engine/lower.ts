import { parser } from '@lezer/python';
import type { SyntaxNode } from '@lezer/common';
import { scanComments, type CommentMark } from './comments';
import { decodePythonString, makeDiagnostic, parsePythonNumber, rangeOf, snippet } from './source';
import type { Diagnostic, ImportBinding, IrArg, IrExpr, IrStmt, SourceRange } from './types';

const NOISE = new Set(['(', ')', '[', ']', '{', '}', ',', '.', ':', ';', 'newline', 'eof', 'indent', 'dedent']);

const EXPR_TYPES = new Set([
  'VariableName',
  'Number',
  'String',
  'FormatString',
  'ContinuedString',
  'Boolean',
  'None',
  'BinaryExpression',
  'UnaryExpression',
  'CallExpression',
  'MemberExpression',
  'ArrayExpression',
  'TupleExpression',
  'ParenthesizedExpression',
  'DictionaryExpression',
  'SetExpression',
  'AwaitExpression',
  'ConditionalExpression',
  'LambdaExpression',
  'ComprehensionExpression',
  'ArrayComprehensionExpression',
  'DictionaryComprehensionExpression',
  'SetComprehensionExpression',
  'Ellipsis',
  'NamedExpression',
  'YieldExpression',
]);

const STATEMENT_REASONS: Record<string, string> = {
  ClassDefinition: 'Class definitions cannot be represented as Blockly blocks yet.',
  TryStatement: 'try/except cannot be represented as Blockly blocks yet.',
  WithStatement: 'with statements cannot be represented as Blockly blocks yet.',
  MatchStatement: 'match/case cannot be represented as Blockly blocks yet.',
  RaiseStatement: 'raise cannot be represented as Blockly blocks yet.',
  DeleteStatement: 'del cannot be represented as Blockly blocks yet.',
  AssertStatement: 'assert cannot be represented as Blockly blocks yet.',
  YieldStatement: 'yield cannot be represented as Blockly blocks yet.',
  DecoratedStatement: 'Decorators cannot be represented as Blockly blocks yet.',
  ScopeStatement: 'global and nonlocal cannot be represented as Blockly blocks yet.',
  TypeDefinition: 'type aliases cannot be represented as Blockly blocks yet.',
};

const COMPARE_OPS = new Set(['<', '>', '<=', '>=', '==', '!=', '<>', 'in', 'not in', 'is', 'is not']);

export interface LowerResult {
  body: IrStmt[];
  diagnostics: Diagnostic[];
  comments: CommentMark[];
}

export function lower(code: string): LowerResult {
  const tree = parser.parse(code);
  const diagnostics: Diagnostic[] = [];
  tree.iterate({
    enter(node) {
      if (!node.type.isError) return;
      const range = rangeOf(code, node.from, node.to);
      diagnostics.push(
        makeDiagnostic('error', 'syntax', `Python syntax error near “${snippet(code.slice(node.from, node.to) || 'this line', 48)}”.`, range),
      );
    },
  });
  const body: IrStmt[] = [];
  for (let child = tree.topNode.firstChild; child; child = child.nextSibling) {
    body.push(...lowerStatement(child, code, diagnostics));
  }
  const comments = scanComments(code);
  attachComments(body, comments);
  return { body, diagnostics, comments };
}

function children(node: SyntaxNode): SyntaxNode[] {
  const list: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) list.push(child);
  return list;
}

function text(node: SyntaxNode, code: string): string {
  return code.slice(node.from, node.to);
}

function nodeRange(node: SyntaxNode, code: string): SourceRange {
  return rangeOf(code, node.from, node.to);
}

function isNoise(node: SyntaxNode): boolean {
  return NOISE.has(node.type.name);
}

function isExprShape(node: SyntaxNode): boolean {
  return EXPR_TYPES.has(node.type.name) || node.type.isError;
}

function unsupportedStmt(node: SyntaxNode, code: string, reason: string): IrStmt {
  return { kind: 'unsupported', source: text(node, code).trim(), reason, range: nodeRange(node, code) };
}

function unsupportedExpr(node: SyntaxNode, code: string, reason: string): IrExpr {
  return { kind: 'unsupported', source: text(node, code).trim(), reason, range: nodeRange(node, code) };
}

function lowerStatement(node: SyntaxNode, code: string, diagnostics: Diagnostic[]): IrStmt[] {
  if (node.type.name === 'Comment') return [];
  if (node.type.name === 'StatementGroup') {
    return children(node).flatMap((child) => (isNoise(child) ? [] : lowerStatement(child, code, diagnostics)));
  }
  if (node.type.isError) {
    return [unsupportedStmt(node, code, 'This line has a Python syntax error.')];
  }
  switch (node.type.name) {
    case 'AssignStatement':
      return [lowerAssign(node, code, diagnostics)];
    case 'UpdateStatement':
      return [lowerUpdate(node, code, diagnostics)];
    case 'ExpressionStatement':
      return [lowerExprStmt(node, code, diagnostics)];
    case 'PassStatement':
      return [{ kind: 'pass', range: nodeRange(node, code) }];
    case 'BreakStatement':
      return [{ kind: 'break', range: nodeRange(node, code) }];
    case 'ContinueStatement':
      return [{ kind: 'continue', range: nodeRange(node, code) }];
    case 'ReturnStatement':
      return [lowerReturn(node, code, diagnostics)];
    case 'ImportStatement':
      return [lowerImport(node, code)];
    case 'IfStatement':
      return [lowerIf(node, code, diagnostics)];
    case 'WhileStatement':
      return lowerWhile(node, code, diagnostics);
    case 'ForStatement':
      return lowerFor(node, code, diagnostics);
    case 'FunctionDefinition':
      return [lowerFunction(node, code, diagnostics)];
    default:
      if (isNoise(node)) return [];
      return [
        unsupportedStmt(node, code, STATEMENT_REASONS[node.type.name] ?? `Unsupported syntax (${node.type.name}).`),
      ];
  }
}

function lowerBody(node: SyntaxNode, code: string, diagnostics: Diagnostic[]): IrStmt[] {
  const statements: IrStmt[] = [];
  for (const child of children(node)) {
    if (child.type.name === ':' || isNoise(child)) continue;
    statements.push(...lowerStatement(child, code, diagnostics));
  }
  return statements;
}

function lowerAssign(node: SyntaxNode, code: string, diagnostics: Diagnostic[]): IrStmt {
  const range = nodeRange(node, code);
  const segments: SyntaxNode[][] = [[]];
  let annotated = false;
  for (const child of children(node)) {
    if (child.type.name === 'AssignOp') segments.push([]);
    else if (child.type.name === 'TypeDef') annotated = true;
    else segments[segments.length - 1]?.push(child);
  }
  if (annotated) {
    diagnostics.push(
      makeDiagnostic('info', 'annotation', 'Type annotations are not shown on the blocks.', range),
    );
  }
  const populated = segments.filter((segment) => segment.some((child) => !isNoise(child)));
  if (populated.length < 2) {
    return unsupportedStmt(node, code, 'This assignment cannot be represented as a block yet.');
  }
  const valueSegment = populated[populated.length - 1] ?? [];
  const targetSegments = populated.slice(0, -1);
  const valueItems = splitItems(valueSegment);

  if (targetSegments.length > 1 && valueItems.length === 1 && valueItems[0]) {
    const names = targetSegments.map((segment) => namesIn(segment, code));
    if (names.every((list) => list?.length === 1)) {
      const value = lowerExpr(valueItems[0], code, diagnostics);
      if (isPure(value)) {
        return { kind: 'assign', targets: names.map((list) => list?.[0] ?? ''), value, range };
      }
      return unsupportedStmt(node, code, 'Chained assignment of a call or other expression is kept as source so it does not run twice.');
    }
  }

  const targetNames = targetSegments.length === 1 ? namesIn(targetSegments[0] ?? [], code) : null;
  if (targetNames?.length === 1 && valueItems.length === 1 && valueItems[0]) {
    return { kind: 'assign', targets: targetNames, value: lowerExpr(valueItems[0], code, diagnostics), range };
  }
  if (targetNames && targetNames.length > 1 && valueItems.length === targetNames.length) {
    const values = valueItems.map((item) => lowerExpr(item, code, diagnostics));
    if (values.every(isPure)) {
      return { kind: 'assign', targets: targetNames, value: { kind: 'list', items: values, tuple: true, range }, range };
    }
  }
  return unsupportedStmt(
    node,
    code,
    'This assignment was kept as source so the value is not evaluated more than once or unpacked incorrectly.',
  );
}

function lowerUpdate(node: SyntaxNode, code: string, diagnostics: Diagnostic[]): IrStmt {
  const kids = children(node).filter((child) => !isNoise(child));
  const target = kids.find((child) => child.type.name === 'VariableName');
  const op = kids.find((child) => child.type.name === 'UpdateOp');
  const value = kids.find((child) => child !== target && child !== op && isExprShape(child));
  if (!target || !op || !value || kids.filter((child) => child.type.name === 'VariableName').length !== 1) {
    return unsupportedStmt(node, code, 'This update assignment was kept as source.');
  }
  return {
    kind: 'augAssign',
    target: text(target, code),
    op: text(op, code),
    value: lowerExpr(value, code, diagnostics),
    range: nodeRange(node, code),
  };
}

function lowerExprStmt(node: SyntaxNode, code: string, diagnostics: Diagnostic[]): IrStmt {
  const exprNode = children(node).find((child) => !isNoise(child) && child.type.name !== 'newline');
  if (!exprNode) return unsupportedStmt(node, code, 'Empty expression.');
  if (exprNode.type.name === 'String' || (exprNode.type.name === 'FormatString' && !hasFormatReplacement(exprNode))) {
    const decoded = decodePythonString(text(exprNode, code));
    if (decoded && !decoded.formatted) {
      return { kind: 'doc', text: decoded.value, range: nodeRange(node, code) };
    }
  }
  return { kind: 'expr', expr: lowerExpr(exprNode, code, diagnostics), range: nodeRange(node, code) };
}

function lowerReturn(node: SyntaxNode, code: string, diagnostics: Diagnostic[]): IrStmt {
  const exprNode = children(node).find((child) => child.type.name !== 'return' && !isNoise(child));
  return {
    kind: 'return',
    value: exprNode ? lowerExpr(exprNode, code, diagnostics) : null,
    range: nodeRange(node, code),
  };
}

function lowerImport(node: SyntaxNode, code: string): IrStmt {
  const source = text(node, code).trim();
  return { kind: 'import', source, names: parseImportNames(source), range: nodeRange(node, code) };
}

export function parseImportNames(source: string): ImportBinding[] {
  const compact = source.replace(/\s+/g, ' ').trim();
  const fromMatch = /^from\s+(\S+)\s+import\s+(.+)$/.exec(compact);
  if (fromMatch) {
    const moduleName = fromMatch[1] ?? '';
    const importedPart = (fromMatch[2] ?? '').replace(/[()]/g, '').trim();
    if (importedPart === '*') return [{ module: moduleName, imported: '*', local: '*' }];
    return importedPart
      .split(',')
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const [imported, alias] = chunk.split(/\s+as\s+/);
        const clean = (imported ?? '').trim();
        return { module: moduleName, imported: clean, local: (alias ?? clean).trim() };
      });
  }
  const importMatch = /^import\s+(.+)$/.exec(compact);
  if (!importMatch) return [];
  return (importMatch[1] ?? '')
    .split(',')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [moduleName, alias] = chunk.split(/\s+as\s+/);
      const clean = (moduleName ?? '').trim();
      const local = (alias ?? clean.split('.').at(-1) ?? clean).trim();
      return { module: clean, imported: null, local };
    });
}

function lowerIf(node: SyntaxNode, code: string, diagnostics: Diagnostic[]): IrStmt {
  const branches: { test: IrExpr | null; body: IrStmt[] }[] = [];
  let pending: IrExpr | null = null;
  let sawTest = false;
  for (const child of children(node)) {
    if (child.type.name === 'if' || child.type.name === 'elif' || child.type.name === ':') continue;
    if (child.type.name === 'else') {
      pending = null;
      sawTest = false;
      continue;
    }
    if (child.type.name === 'elseClause') {
      const body = children(child).find((item) => item.type.name === 'Body');
      branches.push({ test: null, body: body ? lowerBody(body, code, diagnostics) : [] });
      pending = null;
      sawTest = false;
      continue;
    }
    if (child.type.name === 'Body') {
      branches.push({ test: sawTest ? pending : null, body: lowerBody(child, code, diagnostics) });
      pending = null;
      sawTest = false;
      continue;
    }
    if (isExprShape(child)) {
      pending = lowerExpr(child, code, diagnostics);
      sawTest = true;
    }
  }
  const first = branches[0];
  const elifs: { test: IrExpr; body: IrStmt[] }[] = [];
  let elseBody: IrStmt[] | null = null;
  for (const branch of branches.slice(1)) {
    if (branch.test) elifs.push({ test: branch.test, body: branch.body });
    else elseBody = branch.body;
  }
  return {
    kind: 'if',
    test: first?.test ?? unsupportedExpr(node, code, 'if statement is missing its condition.'),
    body: first?.body ?? [],
    elifs,
    elseBody,
    range: nodeRange(node, code),
  };
}

function lowerWhile(node: SyntaxNode, code: string, diagnostics: Diagnostic[]): IrStmt[] {
  const loop = lowerLoop(node, code, diagnostics, 'while');
  return loop;
}

function lowerFor(node: SyntaxNode, code: string, diagnostics: Diagnostic[]): IrStmt[] {
  if (children(node).some((child) => child.type.name === 'async')) {
    return [unsupportedStmt(node, code, 'async for is kept as source.')];
  }
  const kids = children(node);
  const inIndex = kids.findIndex((child) => child.type.name === 'in');
  const body = kids.find((child) => child.type.name === 'Body');
  const targetNodes = kids.slice(0, inIndex).filter((child) => child.type.name !== 'for' && child.type.name !== 'async' && !isNoise(child));
  const iterNodes = kids
    .slice(inIndex + 1)
    .filter((child) => child.type.name !== 'Body' && child.type.name !== 'else' && child.type.name !== 'elseClause' && !isNoise(child));
  if (targetNodes.length !== 1 || targetNodes[0]?.type.name !== 'VariableName' || !iterNodes[0] || !body) {
    return [unsupportedStmt(node, code, 'This for loop was kept as source. Only a single loop variable is supported.')];
  }
  const statement: IrStmt = {
    kind: 'for',
    target: text(targetNodes[0], code),
    iter: lowerExpr(iterNodes[0], code, diagnostics),
    body: lowerBody(body, code, diagnostics),
    range: nodeRange(node, code),
  };
  return withLoopElse(node, code, diagnostics, statement);
}

function lowerLoop(node: SyntaxNode, code: string, diagnostics: Diagnostic[], keyword: 'while'): IrStmt[] {
  const kids = children(node);
  const body = kids.find((child) => child.type.name === 'Body');
  const test = kids.find((child) => child.type.name !== keyword && child.type.name !== 'Body' && child.type.name !== 'else' && child.type.name !== 'elseClause' && !isNoise(child));
  if (!test || !body) return [unsupportedStmt(node, code, 'This loop was kept as source.')];
  const statement: IrStmt = {
    kind: 'while',
    test: lowerExpr(test, code, diagnostics),
    body: lowerBody(body, code, diagnostics),
    range: nodeRange(node, code),
  };
  return withLoopElse(node, code, diagnostics, statement);
}

function withLoopElse(node: SyntaxNode, code: string, diagnostics: Diagnostic[], statement: IrStmt): IrStmt[] {
  const elseNode = children(node).find((child) => child.type.name === 'else' || child.type.name === 'elseClause');
  if (!elseNode) return [statement];
  const range = nodeRange(elseNode, code);
  diagnostics.push(
    makeDiagnostic(
      'warning',
      'loop-else',
      'The else clause on this loop runs only when the loop does not break. It is kept as source.',
      range,
    ),
  );
  const elseBody = children(node).filter((child) => child.type.name === 'Body').at(-1);
  const source = elseBody ? text(elseBody, code).replace(/^:/, '').trim() : text(elseNode, code).trim();
  return [statement, { kind: 'unsupported', source, reason: 'Loop else clause kept as source.', range }];
}

function lowerFunction(node: SyntaxNode, code: string, diagnostics: Diagnostic[]): IrStmt {
  const async = children(node).some((child) => child.type.name === 'async');
  const nameNode = children(node).find((child) => child.type.name === 'VariableName');
  const params = children(node).find((child) => child.type.name === 'ParamList');
  const bodyNode = children(node).find((child) => child.type.name === 'Body');
  const parsedParams = params ? parseParams(params, code, diagnostics, nodeRange(node, code)) : { names: [], defaults: [] };
  let body = bodyNode ? lowerBody(bodyNode, code, diagnostics) : [];
  let docstring: string | undefined;
  if (body[0]?.kind === 'doc') {
    docstring = body[0].text;
    body = body.slice(1);
  }
  return {
    kind: 'func',
    name: nameNode ? text(nameNode, code) : 'unnamed',
    params: parsedParams.names,
    defaults: parsedParams.defaults,
    body,
    async,
    docstring,
    range: nodeRange(node, code),
  };
}

function parseParams(
  node: SyntaxNode,
  code: string,
  diagnostics: Diagnostic[],
  range: SourceRange,
): { names: string[]; defaults: string[] } {
  const names: string[] = [];
  const defaults: string[] = [];
  let group: SyntaxNode[] = [];
  let starred = false;
  const flush = () => {
    if (group.length === 0) return;
    const star = group.some((child) => text(child, code) === '*' || text(child, code) === '**' || text(child, code) === '/');
    if (star) starred = true;
    else {
      const name = group.find((child) => child.type.name === 'VariableName');
      const assign = group.findIndex((child) => child.type.name === 'AssignOp');
      if (name) {
        names.push(text(name, code));
        if (assign >= 0) defaults.push(`${text(name, code)}=${group.slice(assign + 1).map((child) => text(child, code)).join('')}`);
      }
    }
    group = [];
  };
  for (const child of children(node)) {
    if (child.type.name === ',') {
      flush();
      continue;
    }
    if (child.type.name === '(' || child.type.name === ')') continue;
    group.push(child);
  }
  flush();
  if (starred) {
    diagnostics.push(
      makeDiagnostic('warning', 'star-args', '*, *args, or **kwargs parameters are kept out of the function block.', range),
    );
  }
  if (defaults.length > 0) {
    diagnostics.push(
      makeDiagnostic('warning', 'param-default', `Default parameter values are kept in a note: ${defaults.join(', ')}.`, range),
    );
  }
  return { names, defaults };
}

function lowerExpr(node: SyntaxNode, code: string, diagnostics: Diagnostic[]): IrExpr {
  if (node.type.isError) return unsupportedExpr(node, code, 'This expression contains a syntax error.');
  switch (node.type.name) {
    case 'ParenthesizedExpression': {
      const inner = children(node).find((child) => isExprShape(child));
      return inner ? lowerExpr(inner, code, diagnostics) : unsupportedExpr(node, code, 'Empty parentheses.');
    }
    case 'Number': {
      const raw = text(node, code);
      const value = parsePythonNumber(raw);
      if (value === null) return unsupportedExpr(node, code, 'This number cannot be shown as a Blockly number.');
      return { kind: 'number', value, raw, range: nodeRange(node, code) };
    }
    case 'String':
    case 'FormatString':
    case 'ContinuedString':
      return lowerString(node, code);
    case 'Boolean':
      return { kind: 'bool', value: text(node, code) === 'True', range: nodeRange(node, code) };
    case 'None':
      return { kind: 'none', range: nodeRange(node, code) };
    case 'VariableName':
      return { kind: 'name', name: text(node, code), range: nodeRange(node, code) };
    case 'UnaryExpression':
      return lowerUnary(node, code, diagnostics);
    case 'BinaryExpression':
      return lowerBinary(node, code, diagnostics);
    case 'CallExpression':
      return lowerCall(node, code, diagnostics);
    case 'MemberExpression':
      return lowerMember(node, code, diagnostics);
    case 'ArrayExpression':
      return { kind: 'list', items: listItems(node, code, diagnostics), tuple: false, range: nodeRange(node, code) };
    case 'TupleExpression':
      return { kind: 'list', items: listItems(node, code, diagnostics), tuple: true, range: nodeRange(node, code) };
    case 'AwaitExpression': {
      const inner = children(node).find((child) => child.type.name !== 'await' && isExprShape(child));
      if (!inner) return unsupportedExpr(node, code, 'await is missing an expression.');
      return { kind: 'await', expr: lowerExpr(inner, code, diagnostics), range: nodeRange(node, code) };
    }
    case 'ConditionalExpression':
      return lowerConditional(node, code, diagnostics);
    default:
      return unsupportedExpr(
        node,
        code,
        node.type.name === 'LambdaExpression'
          ? 'lambda cannot be represented as a Blockly block yet.'
          : node.type.name.includes('Comprehension')
            ? 'Comprehensions cannot be represented as Blockly blocks yet.'
            : node.type.name === 'NamedExpression'
              ? 'The := operator is kept as source.'
              : node.type.name === 'DictionaryExpression' || node.type.name === 'SetExpression'
                ? 'Dictionaries and sets are kept as source.'
                : `This expression (${node.type.name}) is kept as source.`,
      );
  }
}

function lowerString(node: SyntaxNode, code: string): IrExpr {
  if (node.type.name === 'FormatString' && hasFormatReplacement(node)) {
    return unsupportedExpr(node, code, 'f-strings with values inside braces are kept as source.');
  }
  if (node.type.name === 'ContinuedString') {
    const parts = children(node).filter((child) => child.type.name === 'String' || child.type.name === 'FormatString');
    if (parts.some((part) => part.type.name === 'FormatString' && hasFormatReplacement(part))) {
      return unsupportedExpr(node, code, 'Adjacent strings containing formatted values are kept as source.');
    }
    const decoded = parts.map((part) => decodePythonString(text(part, code)));
    if (decoded.every(Boolean)) {
      return {
        kind: 'string',
        value: decoded.map((item) => item?.value ?? '').join(''),
        bytes: decoded.some((item) => item?.bytes),
        range: nodeRange(node, code),
      };
    }
  }
  const decoded = decodePythonString(text(node, code));
  if (!decoded) return unsupportedExpr(node, code, 'This string could not be read.');
  return { kind: 'string', value: decoded.value, bytes: decoded.bytes, range: nodeRange(node, code) };
}

function hasFormatReplacement(node: SyntaxNode): boolean {
  return children(node).some((child) => child.type.name === 'FormatReplacement');
}

function lowerUnary(node: SyntaxNode, code: string, diagnostics: Diagnostic[]): IrExpr {
  const kids = children(node);
  const exprNode = [...kids].reverse().find((child) => isExprShape(child));
  const op = kids
    .filter((child) => child !== exprNode)
    .map((child) => text(child, code))
    .join(' ')
    .trim();
  if (!exprNode) return unsupportedExpr(node, code, 'This unary expression is kept as source.');
  if (op === 'not') return liftNot(exprNode, code, diagnostics, nodeRange(node, code));
  return { kind: 'unary', op, expr: lowerExpr(exprNode, code, diagnostics), range: nodeRange(node, code) };
}

/**
 * @lezer/python currently binds `not` more loosely than `and`/`or`.
 * Python does the opposite, so `not ready and flag` is repaired to `(not ready) and flag`.
 * Parentheses still win because they remain a ParenthesizedExpression.
 */
function liftNot(node: SyntaxNode, code: string, diagnostics: Diagnostic[], range: SourceRange): IrExpr {
  if (node.type.name === 'BinaryExpression') {
    const parts = splitBinary(node, code);
    if (parts && (parts.op === 'and' || parts.op === 'or')) {
      return {
        kind: 'binary',
        op: parts.op,
        left: liftNot(parts.left, code, diagnostics, nodeRange(parts.left, code)),
        right: lowerExpr(parts.right, code, diagnostics),
        range,
      };
    }
  }
  return { kind: 'unary', op: 'not', expr: lowerExpr(node, code, diagnostics), range };
}

function lowerBinary(node: SyntaxNode, code: string, diagnostics: Diagnostic[]): IrExpr {
  const parts = splitBinary(node, code);
  if (!parts) return unsupportedExpr(node, code, 'This expression is kept as source.');
  if (COMPARE_OPS.has(parts.op) && parts.left.type.name === 'BinaryExpression') {
    const leftParts = splitBinary(parts.left, code);
    if (leftParts && COMPARE_OPS.has(leftParts.op)) {
      const middle = lowerExpr(leftParts.right, code, diagnostics);
      if (!isPure(middle)) {
        return unsupportedExpr(
          node,
          code,
          'Chained comparisons with function calls are kept as source so nothing runs twice.',
        );
      }
      return {
        kind: 'binary',
        op: 'and',
        left: lowerBinary(parts.left, code, diagnostics),
        right: {
          kind: 'binary',
          op: normalizeCompare(parts.op),
          left: middle,
          right: lowerExpr(parts.right, code, diagnostics),
          range: nodeRange(node, code),
        },
        range: nodeRange(node, code),
      };
    }
  }
  return {
    kind: 'binary',
    op: normalizeCompare(parts.op),
    left: lowerExpr(parts.left, code, diagnostics),
    right: lowerExpr(parts.right, code, diagnostics),
    range: nodeRange(node, code),
  };
}

function normalizeCompare(op: string): string {
  return op === '<>' ? '!=' : op;
}

function splitBinary(node: SyntaxNode, code: string): { left: SyntaxNode; op: string; right: SyntaxNode } | null {
  const kids = children(node);
  const exprIndexes = kids.flatMap((child, index) => (isExprShape(child) ? [index] : []));
  if (exprIndexes.length < 2) return null;
  const first = exprIndexes[0] ?? 0;
  const last = exprIndexes[exprIndexes.length - 1] ?? first;
  const left = kids[first];
  const right = kids[last];
  if (!left || !right) return null;
  const op = kids
    .slice(first + 1, last)
    .map((child) => text(child, code))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { left, op, right };
}

function lowerCall(node: SyntaxNode, code: string, diagnostics: Diagnostic[]): IrExpr {
  const callee = children(node).find((child) => child.type.name !== 'ArgList' && isExprShape(child));
  const args = children(node).find((child) => child.type.name === 'ArgList');
  if (!callee || !args) return unsupportedExpr(node, code, 'This call is kept as source.');
  return {
    kind: 'call',
    callee: lowerExpr(callee, code, diagnostics),
    args: lowerArgs(args, code, diagnostics),
    range: nodeRange(node, code),
  };
}

function lowerArgs(node: SyntaxNode, code: string, diagnostics: Diagnostic[]): IrArg[] {
  const groups: SyntaxNode[][] = [[]];
  for (const child of children(node)) {
    if (child.type.name === '(' || child.type.name === ')') continue;
    if (child.type.name === ',') groups.push([]);
    else groups[groups.length - 1]?.push(child);
  }
  return groups.filter((group) => group.length > 0).map((group) => {
    const assignAt = group.findIndex((child) => child.type.name === 'AssignOp');
    if (assignAt > 0 && group[0]?.type.name === 'VariableName') {
      const valueNode = group.slice(assignAt + 1).find((child) => isExprShape(child));
      return {
        name: text(group[0], code),
        value: valueNode
          ? lowerExpr(valueNode, code, diagnostics)
          : unsupportedExpr(node, code, 'Keyword argument has no value.'),
      };
    }
    if (group.some((child) => text(child, code) === '*' || text(child, code) === '**')) {
      return { value: unsupportedExpr(node, code, 'Starred arguments are kept as source.') };
    }
    const exprNode = group.find((child) => isExprShape(child));
    return {
      value: exprNode ? lowerExpr(exprNode, code, diagnostics) : unsupportedExpr(node, code, 'Blank argument.'),
    };
  });
}

function lowerMember(node: SyntaxNode, code: string, diagnostics: Diagnostic[]): IrExpr {
  const kids = children(node);
  const bracket = kids.findIndex((child) => child.type.name === '[');
  if (bracket >= 0) {
    const object = kids.slice(0, bracket).find((child) => isExprShape(child));
    const end = kids.findIndex((child) => child.type.name === ']');
    const inside = kids.slice(bracket + 1, end >= 0 ? end : kids.length).filter((child) => !isNoise(child));
    if (!object || inside.length !== 1 || !inside[0]) {
      return unsupportedExpr(node, code, 'Slices and multiple indexes are kept as source.');
    }
    return {
      kind: 'index',
      object: lowerExpr(object, code, diagnostics),
      index: lowerExpr(inside[0], code, diagnostics),
      range: nodeRange(node, code),
    };
  }
  if (kids.some((child) => child.type.name === 'subscript')) {
    return unsupportedExpr(node, code, 'This index expression is kept as source.');
  }
  const property = kids.find((child) => child.type.name === 'PropertyName');
  const object = kids.find((child) => isExprShape(child));
  if (!property || !object) return unsupportedExpr(node, code, 'This attribute is kept as source.');
  return {
    kind: 'attr',
    object: lowerExpr(object, code, diagnostics),
    name: text(property, code),
    range: nodeRange(node, code),
  };
}

function lowerConditional(node: SyntaxNode, code: string, diagnostics: Diagnostic[]): IrExpr {
  const exprs = children(node).filter((child) => isExprShape(child));
  if (exprs.length < 3 || !exprs[0] || !exprs[1] || !exprs[2]) {
    return unsupportedExpr(node, code, 'This conditional expression is kept as source.');
  }
  return {
    kind: 'conditional',
    thenExpr: lowerExpr(exprs[0], code, diagnostics),
    test: lowerExpr(exprs[1], code, diagnostics),
    elseExpr: lowerExpr(exprs[2], code, diagnostics),
    range: nodeRange(node, code),
  };
}

function listItems(node: SyntaxNode, code: string, diagnostics: Diagnostic[]): IrExpr[] {
  return splitItems(children(node))
    .filter((item) => item.type.name !== '[' && item.type.name !== ']' && item.type.name !== '(' && item.type.name !== ')')
    .map((item) => lowerExpr(item, code, diagnostics));
}

function splitItems(nodes: SyntaxNode[]): SyntaxNode[] {
  const items: SyntaxNode[] = [];
  for (const node of nodes) {
    if (isNoise(node)) continue;
    items.push(node);
  }
  return items;
}

function namesIn(nodes: SyntaxNode[], code: string): string[] | null {
  const clean = nodes.filter((node) => !isNoise(node));
  if (clean.length === 0 || clean.some((node) => node.type.name !== 'VariableName')) return null;
  return clean.map((node) => text(node, code));
}

function isPure(expr: IrExpr): boolean {
  return expr.kind === 'number' || expr.kind === 'string' || expr.kind === 'bool' || expr.kind === 'none' || expr.kind === 'name';
}

function attachComments(statements: IrStmt[], comments: CommentMark[]): void {
  const used = new Set<number>();
  for (const comment of comments) {
    const host = commentHost(statements, comment);
    if (!host) continue;
    used.add(comment.start);
    host.comment = host.comment ? `${host.comment}\n${comment.text}` : comment.text;
  }
  void used;
}

function commentHost(statements: IrStmt[], comment: CommentMark): IrStmt | null {
  const found: { host: IrStmt | null } = { host: null };
  const visit = (list: IrStmt[]) => {
    for (const statement of list) {
      if (statement.range.start <= comment.start && comment.start < statement.range.end) {
        found.host = statement;
        visit(nestedStatements(statement));
      }
    }
  };
  visit(statements);
  const container = found.host;
  if (container) {
    const inline = descendants(container).filter(
      (statement) => statement.range.line === comment.line && statement.range.end <= comment.start,
    );
    inline.sort((a, b) => b.range.end - a.range.end);
    if (inline[0]) return inline[0];
    if (comment.line !== container.range.line) {
      const next = nextDescendant(container, comment);
      if (next) return next;
    }
    return container;
  }
  let next: IrStmt | null = null;
  const visitAfter = (list: IrStmt[]) => {
    for (const statement of list) {
      if (statement.range.start >= comment.end && (!next || statement.range.start < next.range.start)) next = statement;
      visitAfter(nestedStatements(statement));
    }
  };
  visitAfter(statements);
  return next;
}

function nextDescendant(statement: IrStmt, comment: CommentMark): IrStmt | null {
  let next: IrStmt | null = null;
  for (const child of descendants(statement)) {
    if (child.range.start >= comment.end && (!next || child.range.start < next.range.start)) next = child;
  }
  return next;
}

function descendants(statement: IrStmt): IrStmt[] {
  return nestedStatements(statement).flatMap((child) => [child, ...descendants(child)]);
}

function nestedStatements(statement: IrStmt): IrStmt[] {
  switch (statement.kind) {
    case 'if':
      return [...statement.body, ...statement.elifs.flatMap((branch) => branch.body), ...(statement.elseBody ?? [])];
    case 'while':
    case 'for':
    case 'func':
      return statement.body;
    default:
      return [];
  }
}
