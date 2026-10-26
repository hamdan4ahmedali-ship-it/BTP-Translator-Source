import type { LowerResult } from './lower';
import {
  BLOCK_SPECS,
  COMPONENTS,
  ENUM_OPTIONS,
  MODULE_EXPORTS,
  type BlockSpec,
  type EnumKind,
  type ParamSpec,
  specByKey,
} from './registry';
import { makeDiagnostic, snippet } from './source';
import type { BlockJson, Diagnostic, IrArg, IrExpr, IrStmt, SourceRange, WorkspaceState } from './types';

const ARITH: Record<string, string> = { '+': 'ADD', '-': 'MINUS', '*': 'MULTIPLY', '/': 'DIVIDE', '**': 'POWER' };
const COMPARE: Record<string, string> = { '==': 'EQ', '!=': 'NEQ', '<': 'LT', '<=': 'LTE', '>': 'GT', '>=': 'GTE' };
const ENUM_CLASS: Record<string, Exclude<EnumKind, 'bool'>> = {
  Port: 'port', Direction: 'direction', Stop: 'stop', Color: 'color', Button: 'button', Side: 'side', Axis: 'axis',
};
const AUGMENT: Record<string, string> = { '+=': '+', '-=': '-', '*=': '*', '/=': '/', '//=': '//', '%=': '%', '**=': '**' };

interface Piece { inline: BlockJson[]; floats: BlockJson[] }

export interface EmitResult {
  workspace: WorkspaceState;
  diagnostics: Diagnostic[];
  preservedComments: string[];
  blockTypes: string[];
}

class Ctx {
  variables = new Map<string, { id: string; name: string }>();
  symbols = new Map<string, string>();
  diagnostics: Diagnostic[];
  preservedComments: string[] = [];
  blockTypes: string[] = [];
  private serial = 0;
  private onceKeys = new Set<string>();

  constructor(readonly code: string, diagnostics: Diagnostic[]) {
    this.diagnostics = diagnostics;
  }

  nextId(): string {
    this.serial += 1;
    return `b${this.serial}`;
  }

  ensureVar(name: string): { id: string; name: string } {
    const existing = this.variables.get(name);
    if (existing) return existing;
    const created = { id: `v_${name.replace(/[^A-Za-z0-9_]/g, '_')}_${this.variables.size + 1}`, name };
    this.variables.set(name, created);
    return created;
  }

  add(severity: Diagnostic['severity'], code: string, message: string, range: SourceRange, once = false): void {
    if (once && this.onceKeys.has(code)) return;
    if (once) this.onceKeys.add(code);
    if (this.diagnostics.some((item) => item.code === code && item.line === range.line && item.message === message)) return;
    this.diagnostics.push(makeDiagnostic(severity, code, message, range));
  }
}

export function emit(code: string, lowered: LowerResult): EmitResult {
  const ctx = new Ctx(code, [...lowered.diagnostics]);
  prebind(lowered.body, ctx);
  const piece = emitList(lowered.body, ctx);
  const roots: BlockJson[] = [];
  const main = chain(piece.inline);
  if (main) {
    main.x = 48;
    main.y = 40;
    roots.push(main);
  }
  piece.floats.forEach((blockNode, index) => {
    blockNode.x = 620;
    blockNode.y = 40 + index * 220;
    roots.push(blockNode);
  });
  return {
    workspace: {
      blocks: { languageVersion: 0, blocks: roots },
      variables: [...ctx.variables.values()].map((variable) => ({ name: variable.name, id: variable.id, type: '' })),
    },
    diagnostics: ctx.diagnostics,
    preservedComments: ctx.preservedComments,
    blockTypes: ctx.blockTypes,
  };
}

function prebind(statements: IrStmt[], ctx: Ctx): void {
  for (const statement of statements) {
    if (statement.kind === 'import') applyImport(statement, ctx);
    if (statement.kind === 'func') ctx.symbols.set(statement.name, `function:${statement.name}`);
    prebind(nested(statement), ctx);
  }
}

function applyImport(statement: Extract<IrStmt, { kind: 'import' }>, ctx: Ctx): void {
  for (const binding of statement.names) {
    if (binding.imported === '*') {
      const table = MODULE_EXPORTS[binding.module];
      if (!table) {
        ctx.add('warning', 'import-star', `import * from ${binding.module} is kept as a note.`, statement.range);
        continue;
      }
      for (const [name, symbol] of Object.entries(table)) ctx.symbols.set(name, symbol);
      ctx.add('warning', 'import-star', `import * from ${binding.module} was expanded to the known names in that module.`, statement.range);
      continue;
    }
    if (binding.imported === null) {
      ctx.symbols.set(binding.local, `module:${binding.module}`);
      continue;
    }
    const symbol = MODULE_EXPORTS[binding.module]?.[binding.imported];
    ctx.symbols.set(binding.local, symbol ?? `unknown:${binding.module}.${binding.imported}`);
    if (!symbol && binding.module.startsWith('pybricks.')) {
      ctx.add('info', 'import-unmapped', `${binding.imported} from ${binding.module} is kept as an import. It does not have a block yet.`, statement.range);
    }
  }
}

function emitList(statements: IrStmt[], ctx: Ctx): Piece {
  const piece: Piece = { inline: [], floats: [] };
  for (const statement of statements) {
    const next = emitStmt(statement, ctx);
    piece.inline.push(...next.inline);
    piece.floats.push(...next.floats);
  }
  return piece;
}

function emitStmt(statement: IrStmt, ctx: Ctx): Piece {
  switch (statement.kind) {
    case 'assign':
      return { inline: emitAssign(statement, ctx), floats: [] };
    case 'augAssign':
      return { inline: [emitAugment(statement, ctx)], floats: [] };
    case 'expr':
      return { inline: emitExprStmt(statement.expr, statement.range, statement.comment, ctx), floats: [] };
    case 'doc':
      return { inline: [note(ctx, statement.text, statement.range, statement.comment)], floats: [] };
    case 'if':
      return emitIf(statement, ctx);
    case 'while':
      return emitWhile(statement, ctx);
    case 'for':
      return emitFor(statement, ctx);
    case 'func':
      return { inline: [], floats: [emitFunction(statement, ctx)] };
    case 'return':
      return {
        inline: [
          statement.value
            ? block(ctx, 'btp_return_value', statement.range, statement.comment, {}, { VALUE: { block: emitExpr(statement.value, ctx) } })
            : block(ctx, 'btp_return', statement.range, statement.comment),
        ],
        floats: [],
      };
    case 'break':
      return { inline: [block(ctx, 'controls_flow_statements', statement.range, statement.comment, { FLOW: 'BREAK' })], floats: [] };
    case 'continue':
      return { inline: [block(ctx, 'controls_flow_statements', statement.range, statement.comment, { FLOW: 'CONTINUE' })], floats: [] };
    case 'pass':
      return { inline: [block(ctx, 'btp_pass', statement.range, statement.comment)], floats: [] };
    case 'import':
      return { inline: [block(ctx, 'btp_import', statement.range, statement.comment, { TEXT: snippet(statement.source, 140) })], floats: [] };
    case 'unsupported':
      ctx.add('warning', 'unsupported', `${statement.reason} The original code is still in the workspace.`, statement.range);
      return { inline: [block(ctx, 'btp_unsupported', statement.range, joinComment(statement.comment, statement.source), { TEXT: snippet(statement.source) })], floats: [] };
    default:
      return { inline: [], floats: [] };
  }
}

function emitAssign(statement: Extract<IrStmt, { kind: 'assign' }>, ctx: Ctx): BlockJson[] {
  const target = statement.targets[0];
  if (statement.targets.length === 1 && target && statement.value.kind === 'call') {
    const ctor = emitConstructor(statement.value, target, statement.range, statement.comment, ctx);
    if (ctor) return [ctor];
  }
  if (statement.targets.length > 1 && statement.value.kind === 'list' && statement.value.tuple && statement.value.items.length === statement.targets.length) {
    return statement.targets.map((name, index) => {
      const item = statement.value.kind === 'list' ? statement.value.items[index] : undefined;
      ctx.symbols.set(name, item ? infer(item, ctx) : 'instance:unknown');
      return varSet(ctx, name, item ? emitExpr(item, ctx) : noneBlock(ctx, statement.range), statement.range, index === 0 ? statement.comment : undefined);
    });
  }
  const valueType = infer(statement.value, ctx);
  return statement.targets.map((name, index) => {
    ctx.symbols.set(name, valueType);
    return varSet(ctx, name, emitExpr(statement.value, ctx), statement.range, index === 0 ? statement.comment : undefined);
  });
}

function emitAugment(statement: Extract<IrStmt, { kind: 'augAssign' }>, ctx: Ctx): BlockJson {
  const mapped = AUGMENT[statement.op];
  if (!mapped) {
    ctx.add('warning', 'aug-assign', `${statement.op} is kept as source.`, statement.range);
    return block(ctx, 'btp_unsupported', statement.range, statement.comment, { TEXT: snippet(ctx.code.slice(statement.range.start, statement.range.end)) });
  }
  const binary: IrExpr = {
    kind: 'binary',
    op: mapped,
    left: { kind: 'name', name: statement.target, range: statement.range },
    right: statement.value,
    range: statement.range,
  };
  return varSet(ctx, statement.target, emitExpr(binary, ctx), statement.range, joinComment(statement.comment, `${statement.target} ${statement.op}`));
}

function emitExprStmt(expr: IrExpr, range: SourceRange, comment: string | undefined, ctx: Ctx): BlockJson[] {
  const awaited = expr.kind === 'await' ? expr.expr : expr;
  const noteText = expr.kind === 'await' ? joinComment(comment, 'await') : comment;
  if (awaited.kind === 'call') return [emitCall(awaited, true, range, noteText, ctx)];
  if (awaited.kind === 'unsupported') {
    ctx.add('warning', 'unsupported', `${awaited.reason} The original code is still in the workspace.`, awaited.range);
    return [block(ctx, 'btp_unsupported', range, joinComment(noteText, awaited.source), { TEXT: snippet(awaited.source) })];
  }
  return [block(ctx, 'btp_do', range, noteText, {}, { VALUE: { block: emitExpr(awaited, ctx) } })];
}

function emitIf(statement: Extract<IrStmt, { kind: 'if' }>, ctx: Ctx): Piece {
  const piece = emitList(statement.body, ctx);
  const floats = [...piece.floats];
  const inputs: NonNullable<BlockJson['inputs']> = { IF0: { block: emitExpr(statement.test, ctx) } };
  const body = chain(piece.inline);
  if (body) inputs.DO0 = { block: body };
  statement.elifs.forEach((branch, index) => {
    const inner = emitList(branch.body, ctx);
    floats.push(...inner.floats);
    inputs[`IF${index + 1}`] = { block: emitExpr(branch.test, ctx) };
    const done = chain(inner.inline);
    if (done) inputs[`DO${index + 1}`] = { block: done };
  });
  if (statement.elseBody) {
    const inner = emitList(statement.elseBody, ctx);
    floats.push(...inner.floats);
    const done = chain(inner.inline);
    if (done) inputs.ELSE = { block: done };
  }
  const extra: Record<string, unknown> = {};
  if (statement.elifs.length) extra.elseIfCount = statement.elifs.length;
  if (statement.elseBody) extra.hasElse = true;
  return { inline: [block(ctx, 'controls_if', statement.range, statement.comment, {}, inputs, Object.keys(extra).length ? extra : undefined)], floats };
}

function emitWhile(statement: Extract<IrStmt, { kind: 'while' }>, ctx: Ctx): Piece {
  const piece = emitList(statement.body, ctx);
  const inputs: NonNullable<BlockJson['inputs']> = { BOOL: { block: emitExpr(statement.test, ctx) } };
  const body = chain(piece.inline);
  if (body) inputs.DO = { block: body };
  return { inline: [block(ctx, 'controls_whileUntil', statement.range, statement.comment, { MODE: 'WHILE' }, inputs)], floats: piece.floats };
}

function emitFor(statement: Extract<IrStmt, { kind: 'for' }>, ctx: Ctx): Piece {
  const piece = emitList(statement.body, ctx);
  const body = chain(piece.inline);
  const rangeCall = rangeParts(statement.iter);
  if (rangeCall && rangeCall.start.kind === 'number' && rangeCall.stop.kind === 'number' && rangeCall.step.kind === 'number') {
    const end = inclusiveEnd(rangeCall.start.value, rangeCall.stop.value, rangeCall.step.value);
    if (end !== null) {
      const variable = ctx.ensureVar(statement.target);
      const inputs: NonNullable<BlockJson['inputs']> = {
        FROM: { block: numberBlock(ctx, rangeCall.start.value, statement.range) },
        TO: { block: numberBlock(ctx, end, statement.range) },
        BY: { block: numberBlock(ctx, rangeCall.step.value, statement.range) },
      };
      if (body) inputs.DO = { block: body };
      return { inline: [block(ctx, 'controls_for', statement.range, statement.comment, { VAR: variableField(variable) }, inputs)], floats: piece.floats };
    }
    ctx.add('warning', 'empty-range', 'This range produces no values, so the loop body never runs. The body is still shown.', statement.range);
  }
  if (rangeCall) {
    const inputs: NonNullable<BlockJson['inputs']> = {
      START: { block: emitExpr(rangeCall.start, ctx) },
      STOP: { block: emitExpr(rangeCall.stop, ctx) },
      STEP: { block: emitExpr(rangeCall.step, ctx) },
    };
    if (body) inputs.BODY = { block: body };
    return { inline: [block(ctx, 'btp_for_range', statement.range, statement.comment, { VAR: statement.target }, inputs)], floats: piece.floats };
  }
  const inputs: NonNullable<BlockJson['inputs']> = { LIST: { block: emitExpr(statement.iter, ctx) } };
  if (body) inputs.DO = { block: body };
  return { inline: [block(ctx, 'controls_forEach', statement.range, statement.comment, { VAR: variableField(ctx.ensureVar(statement.target)) }, inputs)], floats: piece.floats };
}

function emitFunction(statement: Extract<IrStmt, { kind: 'func' }>, ctx: Ctx): BlockJson {
  const piece = emitList(statement.body, ctx);
  const notes: BlockJson[] = [];
  if (statement.docstring) notes.push(note(ctx, statement.docstring, statement.range));
  const body = chain([...notes, ...piece.inline]);
  const inputs: NonNullable<BlockJson['inputs']> = {};
  if (body) inputs.BODY = { block: body };
  const comment = joinComment(statement.comment, statement.defaults.length ? `Defaults: ${statement.defaults.join(', ')}` : undefined, statement.async ? 'async function' : undefined);
  return block(ctx, statement.async ? 'btp_async_function' : 'btp_function', statement.range, comment, { NAME: statement.name, PARAMS: statement.params.join(', ') }, inputs);
}

function emitConstructor(expr: Extract<IrExpr, { kind: 'call' }>, name: string, range: SourceRange, comment: string | undefined, ctx: Ctx): BlockJson | null {
  const key = constructorKey(expr, ctx);
  if (!key) return null;
  const spec = specByKey(key);
  if (!spec) return null;
  const className = key.startsWith('ctor:InventorHub') ? 'InventorHub' : key.split(':')[1] ?? 'Motor';
  if (name) ctx.symbols.set(name, `instance:${className}`);
  return emitSpec(spec, null, name || 'device', expr.args, range, comment, ctx);
}

function constructorKey(expr: Extract<IrExpr, { kind: 'call' }>, ctx: Ctx): string | null {
  if (expr.callee.kind !== 'name') return null;
  const symbol = lookupName(expr.callee.name, ctx, expr.range);
  if (!symbol?.startsWith('class:')) return null;
  const className = symbol.slice(6);
  if (className === 'Motor') {
    const positional = expr.args.filter((arg) => !arg.name).length;
    const extra = expr.args.some((arg) => arg.name === 'gears' || arg.name === 'reset_angle' || arg.name === 'profile') || positional > 2;
    return extra ? 'ctor:Motor:full' : 'ctor:Motor';
  }
  if (className === 'PrimeHub' || className === 'InventorHub') return expr.args.length > 0 ? `ctor:${className}:full` : `ctor:${className}`;
  return specByKey(`ctor:${className}`) ? `ctor:${className}` : null;
}

function emitCall(expr: Extract<IrExpr, { kind: 'call' }>, asStatement: boolean, range: SourceRange, comment: string | undefined, ctx: Ctx): BlockJson {
  if (expr.callee.kind === 'name' && expr.callee.name === 'print') return emitPrint(expr, range, comment, ctx);
  const calleeName = expr.callee.kind === 'name' ? expr.callee.name : '';
  const calleeSymbol = calleeName ? lookupName(calleeName, ctx, range) : null;
  if (calleeName === 'multitask' || calleeSymbol === 'func:multitask') return emitMultitask(expr, range, comment, ctx);
  if (calleeName === 'run_task' || calleeSymbol === 'func:run_task') {
    const task = expr.args[0]?.value;
    return block(ctx, 'btp_run_task', range, comment, {}, task ? { TASK: { block: emitExpr(task, ctx) } } : {});
  }
  if (calleeSymbol?.startsWith('function:')) return emitUserCall(calleeName, expr.args, asStatement, range, comment, ctx);
  if (['abs', 'min', 'max', 'int', 'str', 'len'].includes(calleeName)) {
    const value = emitBuiltin(expr, ctx);
    return asStatement ? block(ctx, 'btp_do', range, comment, {}, { VALUE: { block: value } }) : value;
  }
  if (expr.callee.kind === 'attr' && expr.callee.name === 'append' && typeOf(expr.callee.object, ctx) === 'instance:list' && expr.args[0]) {
    return block(ctx, 'btp_list_append', range, comment, { LIST: receiverText(expr.callee.object) ?? 'items' }, { ITEM: { block: emitExpr(expr.args[0].value, ctx) } });
  }
  if (expr.callee.kind === 'attr' && expr.callee.name === 'curve') {
    const owner = classOf(typeOf(expr.callee.object, ctx));
    if (owner === 'DriveBase' || owner === null) {
      ctx.add('warning', 'drivebase-curve', 'DriveBase.curve is not in the current Pybricks API. The documented method is arc(radius, angle=None, distance=None). The original line was kept.', range);
      return block(ctx, 'btp_unsupported', range, joinComment(comment, sourceOf(ctx, expr)), { TEXT: snippet(sourceOf(ctx, expr)) });
    }
  }
  const resolved = resolveMethod(expr, ctx);
  if (!resolved) {
    ctx.add('warning', 'unsupported', 'This call is kept as source because it is not in the supported Python or Pybricks map.', range);
    return block(ctx, asStatement ? 'btp_unsupported' : 'btp_unsupported_value', range, joinComment(comment, sourceOf(ctx, expr)), { TEXT: snippet(sourceOf(ctx, expr)) });
  }
  const action = specByKey(resolved.key);
  const valueSpec = specByKey(`${resolved.key}#value`) ?? (action?.output ? action : undefined);
  const statementSpec = action && !action.output ? action : undefined;
  if (asStatement && statementSpec) return emitSpec(statementSpec, resolved.receiver, null, expr.args, range, comment, ctx);
  if (!asStatement && valueSpec) return emitSpec(valueSpec, resolved.receiver, null, expr.args, range, comment, ctx);
  if (asStatement && valueSpec) {
    return block(ctx, 'btp_do', range, comment, {}, { VALUE: { block: emitSpec(valueSpec, resolved.receiver, null, expr.args, range, undefined, ctx) } });
  }
  ctx.add('warning', 'unsupported', 'This call does not produce a value that can be placed inside another block. It was kept as source.', range);
  return block(ctx, 'btp_unsupported_value', range, joinComment(comment, sourceOf(ctx, expr)), { TEXT: snippet(sourceOf(ctx, expr)) });
}

function resolveMethod(expr: Extract<IrExpr, { kind: 'call' }>, ctx: Ctx): { key: string; receiver: string | null } | null {
  if (expr.callee.kind === 'name') {
    const symbol = lookupName(expr.callee.name, ctx, expr.range);
    if (symbol === 'func:wait') return { key: 'func:wait', receiver: null };
    return null;
  }
  if (expr.callee.kind !== 'attr') return null;
  const className = classOf(typeOf(expr.callee.object, ctx));
  if (!className || className === 'MotorControl') return null;
  const key = `${className}.${expr.callee.name}`;
  if (specByKey(key) || specByKey(`${key}#value`)) return { key, receiver: receiverText(expr.callee.object) };
  return null;
}

function emitSpec(spec: BlockSpec, receiver: string | null, name: string | null, args: IrArg[], range: SourceRange, comment: string | undefined, ctx: Ctx): BlockJson {
  const fields: NonNullable<BlockJson['fields']> = {};
  if (spec.nameField) fields.NAME = name || 'item';
  if (spec.receiver) fields.RECEIVER = receiver || 'device';
  const bound = bindParams(spec, args, ctx, range);
  const inputs: NonNullable<BlockJson['inputs']> = {};
  for (const param of spec.params) {
    const value = bound.get(param.name);
    if (value === undefined) {
      if (!param.optional) ctx.add('warning', 'missing-arg', `${spec.key} is missing ${param.name}.`, range);
      const fallback = defaultParam(param, ctx, range);
      if (fallback) inputs[param.input] = { block: fallback };
      continue;
    }
    inputs[param.input] = { block: emitParam(param, value, ctx) };
  }
  return block(ctx, spec.block, range, comment, fields, inputs);
}

function bindParams(spec: BlockSpec, args: IrArg[], ctx: Ctx, range: SourceRange): Map<string, IrExpr> {
  const bound = new Map<string, IrExpr>();
  const positional = args.filter((arg) => !arg.name);
  let index = 0;
  for (const param of spec.params) {
    const keyword = args.find((arg) => arg.name === param.name);
    if (keyword) bound.set(param.name, keyword.value);
  }
  for (const param of spec.params) {
    if (bound.has(param.name)) continue;
    const next = positional[index];
    if (!next) break;
    bound.set(param.name, next.value);
    index += 1;
  }
  if (index < positional.length) ctx.add('warning', 'extra-arg', 'Extra positional arguments were not given their own inputs. The Python in the editor is unchanged.', range);
  for (const arg of args) {
    if (arg.name && !spec.params.some((param) => param.name === arg.name)) {
      ctx.add('warning', 'unknown-arg', `Argument “${arg.name}” is not part of the documented ${spec.key} signature.`, range);
    }
  }
  return bound;
}

function defaultParam(param: ParamSpec, ctx: Ctx, range: SourceRange): BlockJson | null {
  if (param.omitIfAbsent) return null;
  if (param.enumKind === 'bool' && param.defaultBool !== undefined) return boolBlock(ctx, param.defaultBool, range);
  if (param.enumKind && param.enumKind !== 'bool' && param.defaultEnum) return enumBlock(ctx, param.enumKind, param.defaultEnum, range);
  if (param.defaultNumber !== undefined) return numberBlock(ctx, param.defaultNumber, range);
  return null;
}

function emitParam(param: ParamSpec, expr: IrExpr, ctx: Ctx): BlockJson {
  if (param.enumKind === 'bool' && expr.kind === 'bool') return boolBlock(ctx, expr.value, expr.range);
  if (param.enumKind && param.enumKind !== 'bool') {
    const member = enumMember(expr, param.enumKind, ctx);
    if (member) return enumBlock(ctx, param.enumKind, member, expr.range);
  }
  return emitExpr(expr, ctx);
}

function emitExpr(expr: IrExpr, ctx: Ctx): BlockJson {
  switch (expr.kind) {
    case 'number':
      return numberBlock(ctx, expr.value, expr.range);
    case 'string':
      if (expr.bytes) ctx.add('info', 'bytes', 'A bytes literal is shown as text.', expr.range, true);
      return textBlock(ctx, expr.value, expr.range);
    case 'bool':
      return boolBlock(ctx, expr.value, expr.range);
    case 'none':
      return noneBlock(ctx, expr.range);
    case 'name':
      return varGet(ctx, expr.name, expr.range);
    case 'list':
      if (expr.tuple) ctx.add('info', 'tuple', 'A tuple is shown as a list block.', expr.range, true);
      return listBlock(ctx, expr.items.map((item) => emitExpr(item, ctx)), expr.range);
    case 'unary':
      return emitUnary(expr, ctx);
    case 'binary':
      return emitBinary(expr, ctx);
    case 'call':
      return emitCall(expr, false, expr.range, undefined, ctx);
    case 'attr':
      return emitAttr(expr, ctx);
    case 'index':
      return block(ctx, 'btp_index', expr.range, undefined, {}, { ITEM: { block: emitExpr(expr.index, ctx) }, LIST: { block: emitExpr(expr.object, ctx) } });
    case 'conditional':
      return block(ctx, 'btp_conditional', expr.range, undefined, {}, {
        THEN: { block: emitExpr(expr.thenExpr, ctx) },
        TEST: { block: emitExpr(expr.test, ctx) },
        ELSE: { block: emitExpr(expr.elseExpr, ctx) },
      });
    case 'await':
      return emitExpr(expr.expr, ctx);
    case 'unsupported':
      ctx.add('warning', 'unsupported', `${expr.reason} The original code is still in the workspace.`, expr.range);
      return block(ctx, 'btp_unsupported_value', expr.range, expr.source, { TEXT: snippet(expr.source) });
    default:
      return noneBlock(ctx, blankRange());
  }
}

function emitUnary(expr: Extract<IrExpr, { kind: 'unary' }>, ctx: Ctx): BlockJson {
  if (expr.op === 'not') return block(ctx, 'logic_negate', expr.range, undefined, {}, { BOOL: { block: emitExpr(expr.expr, ctx) } });
  if (expr.op === '+') return emitExpr(expr.expr, ctx);
  if (expr.op === '-' && expr.expr.kind === 'number') return numberBlock(ctx, -expr.expr.value, expr.range);
  if (expr.op === '-') return block(ctx, 'btp_negative', expr.range, undefined, {}, { VALUE: { block: emitExpr(expr.expr, ctx) } });
  ctx.add('warning', 'unsupported', `Unary ${expr.op} is kept as source.`, expr.range);
  return block(ctx, 'btp_unsupported_value', expr.range, sourceOf(ctx, expr), { TEXT: snippet(sourceOf(ctx, expr)) });
}

function emitBinary(expr: Extract<IrExpr, { kind: 'binary' }>, ctx: Ctx): BlockJson {
  const left = { block: emitExpr(expr.left, ctx) };
  const right = { block: emitExpr(expr.right, ctx) };
  if (expr.op === 'and' || expr.op === 'or') return block(ctx, 'logic_operation', expr.range, undefined, { OP: expr.op === 'and' ? 'AND' : 'OR' }, { A: left, B: right });
  if (expr.op === '+' && (expr.left.kind === 'string' || expr.right.kind === 'string')) {
    return block(ctx, 'text_join', expr.range, undefined, {}, { ADD0: left, ADD1: right }, { itemCount: 2 });
  }
  if (ARITH[expr.op]) return block(ctx, 'math_arithmetic', expr.range, undefined, { OP: ARITH[expr.op] ?? 'ADD' }, { A: left, B: right });
  if (COMPARE[expr.op]) return block(ctx, 'logic_compare', expr.range, undefined, { OP: COMPARE[expr.op] ?? 'EQ' }, { A: left, B: right });
  if (expr.op === '%') return block(ctx, 'math_modulo', expr.range, undefined, {}, { DIVIDEND: left, DIVISOR: right });
  if (expr.op === '//') return block(ctx, 'btp_floor_div', expr.range, undefined, {}, { A: left, B: right });
  if (expr.op === 'in' || expr.op === 'not in' || expr.op === 'is' || expr.op === 'is not') {
    const type = expr.op === 'in' ? 'btp_in' : expr.op === 'not in' ? 'btp_not_in' : expr.op === 'is' ? 'btp_is' : 'btp_is_not';
    return block(ctx, type, expr.range, undefined, {}, { A: left, B: right });
  }
  ctx.add('warning', 'unsupported', `Operator ${expr.op} is kept as source.`, expr.range);
  return block(ctx, 'btp_unsupported_value', expr.range, sourceOf(ctx, expr), { TEXT: snippet(sourceOf(ctx, expr)) });
}

function emitAttr(expr: Extract<IrExpr, { kind: 'attr' }>, ctx: Ctx): BlockJson {
  if (expr.object.kind === 'name') {
    const kind = ENUM_CLASS[expr.object.name] ?? enumKindOf(lookupName(expr.object.name, ctx, expr.range));
    if (kind && ENUM_OPTIONS[kind].includes(expr.name)) return enumBlock(ctx, kind, expr.name, expr.range);
  }
  return block(ctx, 'btp_named_constant', expr.range, undefined, { TEXT: receiverText(expr) ?? sourceOf(ctx, expr) });
}

function emitPrint(expr: Extract<IrExpr, { kind: 'call' }>, range: SourceRange, comment: string | undefined, ctx: Ctx): BlockJson {
  const values = expr.args.map((arg) => emitExpr(arg.value, ctx));
  let text: BlockJson;
  if (values.length === 0) text = textBlock(ctx, '', range);
  else if (values.length === 1 && values[0]) text = values[0];
  else {
    const inputs: NonNullable<BlockJson['inputs']> = {};
    values.forEach((value, index) => { inputs[`ADD${index}`] = { block: value }; });
    text = block(ctx, 'text_join', range, undefined, {}, inputs, { itemCount: values.length });
    ctx.add('info', 'print-join', 'print arguments are joined for the block.', range, true);
  }
  return block(ctx, 'text_print', range, comment, {}, { TEXT: { block: text } });
}

function emitBuiltin(expr: Extract<IrExpr, { kind: 'call' }>, ctx: Ctx): BlockJson {
  const name = expr.callee.kind === 'name' ? expr.callee.name : '';
  const first = expr.args[0]?.value;
  if (name === 'len') return block(ctx, 'lists_length', expr.range, undefined, {}, first ? { VALUE: { block: emitExpr(first, ctx) } } : {});
  if (name === 'abs' || name === 'int' || name === 'str') {
    const type = name === 'abs' ? 'btp_abs' : name === 'int' ? 'btp_int' : 'btp_str';
    return block(ctx, type, expr.range, undefined, {}, first ? { VALUE: { block: emitExpr(first, ctx) } } : {});
  }
  if ((name === 'min' || name === 'max') && expr.args.length > 0) {
    const type = name === 'min' ? 'btp_min' : 'btp_max';
    let current = emitExpr(expr.args[0]?.value as IrExpr, ctx);
    for (const arg of expr.args.slice(1)) current = block(ctx, type, expr.range, undefined, {}, { A: { block: current }, B: { block: emitExpr(arg.value, ctx) } });
    return current;
  }
  return block(ctx, 'btp_unsupported_value', expr.range, sourceOf(ctx, expr), { TEXT: snippet(sourceOf(ctx, expr)) });
}

function emitMultitask(expr: Extract<IrExpr, { kind: 'call' }>, range: SourceRange, comment: string | undefined, ctx: Ctx): BlockJson {
  const inputs: NonNullable<BlockJson['inputs']> = {};
  expr.args.forEach((arg, index) => {
    const task = arg.value.kind === 'await' ? arg.value.expr : arg.value;
    const rendered = task.kind === 'call' ? emitCall(task, true, task.range, undefined, ctx) : block(ctx, 'btp_do', task.range, undefined, {}, { VALUE: { block: emitExpr(task, ctx) } });
    inputs[`TASK${index}`] = { block: rendered };
  });
  return block(ctx, 'btp_multitask', range, comment, {}, inputs, { taskCount: Math.max(expr.args.length, 1) });
}

function emitUserCall(name: string, args: IrArg[], asStatement: boolean, range: SourceRange, comment: string | undefined, ctx: Ctx): BlockJson {
  const inputs: NonNullable<BlockJson['inputs']> = {};
  args.forEach((arg, index) => { inputs[`ARG${index}`] = { block: emitExpr(arg.value, ctx) }; });
  return block(ctx, asStatement ? 'btp_call' : 'btp_call_value', range, comment, { NAME: name }, inputs, { argCount: args.length });
}

function lookupName(name: string, ctx: Ctx, range: SourceRange): string | null {
  const existing = ctx.symbols.get(name);
  if (existing) return existing;
  if (ENUM_CLASS[name]) {
    ctx.add('warning', `missing-${name}`, `${name} is used without an import. The blocks still show the Pybricks constant.`, range, true);
    const symbol = `enum:${name}`;
    ctx.symbols.set(name, symbol);
    return symbol;
  }
  return null;
}

function typeOf(expr: IrExpr, ctx: Ctx): string | null {
  if (expr.kind === 'name') return ctx.symbols.get(expr.name) ?? null;
  if (expr.kind !== 'attr') return null;
  const parent = typeOf(expr.object, ctx);
  if (!parent) return null;
  if (parent.startsWith('module:')) return MODULE_EXPORTS[parent.slice(7)]?.[expr.name] ?? null;
  const className = classOf(parent);
  if (!className) return null;
  const component = COMPONENTS[className]?.[expr.name];
  return component ? `instance:${component}` : null;
}

function classOf(symbol: string | null): string | null {
  if (!symbol) return null;
  if (symbol.startsWith('instance:') || symbol.startsWith('class:')) return symbol.slice(symbol.indexOf(':') + 1);
  return null;
}

function enumKindOf(symbol: string | null): Exclude<EnumKind, 'bool'> | null {
  if (!symbol?.startsWith('enum:')) return null;
  return ENUM_CLASS[symbol.slice(5)] ?? null;
}

function enumMember(expr: IrExpr, expected: Exclude<EnumKind, 'bool'>, ctx: Ctx): string | null {
  if (expr.kind !== 'attr' || expr.object.kind !== 'name') return null;
  const kind = ENUM_CLASS[expr.object.name] ?? enumKindOf(ctx.symbols.get(expr.object.name) ?? null);
  if (!kind || kind !== expected || !ENUM_OPTIONS[kind].includes(expr.name)) return null;
  return expr.name;
}

function receiverText(expr: IrExpr): string | null {
  if (expr.kind === 'name') return expr.name;
  if (expr.kind === 'attr') {
    const parent = receiverText(expr.object);
    return parent ? `${parent}.${expr.name}` : null;
  }
  return null;
}

function infer(expr: IrExpr, ctx: Ctx): string {
  switch (expr.kind) {
    case 'number':
    case 'unary':
      return 'instance:number';
    case 'string':
      return 'instance:str';
    case 'bool':
      return 'instance:bool';
    case 'list':
      return 'instance:list';
    case 'name':
      return ctx.symbols.get(expr.name) ?? 'instance:unknown';
    case 'call':
      if (expr.callee.kind === 'name' && ctx.symbols.get(expr.callee.name)?.startsWith('class:')) {
        return `instance:${ctx.symbols.get(expr.callee.name)?.slice(6)}`;
      }
      return 'instance:unknown';
    case 'binary':
      return COMPARE[expr.op] || expr.op === 'and' || expr.op === 'or' || expr.op === 'in' || expr.op === 'is' ? 'instance:bool' : 'instance:number';
    default:
      return 'instance:unknown';
  }
}

function rangeParts(expr: IrExpr): { start: IrExpr; stop: IrExpr; step: IrExpr } | null {
  if (expr.kind !== 'call' || expr.callee.kind !== 'name' || expr.callee.name !== 'range' || expr.args.some((arg) => arg.name)) return null;
  const values = expr.args.map((arg) => arg.value);
  const zero = (value: number): IrExpr => ({ kind: 'number', value, raw: String(value), range: expr.range });
  if (values.length === 1 && values[0]) return { start: zero(0), stop: values[0], step: zero(1) };
  if (values.length === 2 && values[0] && values[1]) return { start: values[0], stop: values[1], step: zero(1) };
  if (values.length === 3 && values[0] && values[1] && values[2]) return { start: values[0], stop: values[1], step: values[2] };
  return null;
}

function inclusiveEnd(start: number, stop: number, step: number): number | null {
  if (step === 0) return null;
  const lastIndex = Math.floor((stop - start - Math.sign(step)) / step);
  if (lastIndex < 0) return null;
  return start + step * lastIndex;
}

function nested(statement: IrStmt): IrStmt[] {
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

function block(ctx: Ctx, type: string, range: SourceRange | undefined, comment?: string, fields?: BlockJson['fields'], inputs?: BlockJson['inputs'], extraState?: Record<string, unknown>): BlockJson {
  ctx.blockTypes.push(type);
  const json: BlockJson = { type, id: ctx.nextId() };
  if (fields && Object.keys(fields).length > 0) json.fields = fields;
  if (inputs && Object.keys(inputs).length > 0) json.inputs = inputs;
  if (extraState) json.extraState = extraState;
  if (range) json.data = JSON.stringify({ line: range.line, start: range.start, end: range.end });
  if (comment?.trim()) {
    ctx.preservedComments.push(comment);
    json.icons = { comment: { text: comment, pinned: false, height: 72, width: 200 } };
  }
  return json;
}

function chain(blocks: BlockJson[]): BlockJson | null {
  const head = blocks[0];
  if (!head) return null;
  let current = head;
  for (const next of blocks.slice(1)) {
    current.next = { block: next };
    current = next;
  }
  return head;
}

function numberBlock(ctx: Ctx, value: number, range: SourceRange): BlockJson {
  return block(ctx, 'math_number', range, undefined, { NUM: value });
}
function textBlock(ctx: Ctx, value: string, range: SourceRange): BlockJson {
  return block(ctx, 'text', range, undefined, { TEXT: value });
}
function boolBlock(ctx: Ctx, value: boolean, range: SourceRange): BlockJson {
  return block(ctx, 'logic_boolean', range, undefined, { BOOL: value ? 'TRUE' : 'FALSE' });
}
function noneBlock(ctx: Ctx, range: SourceRange): BlockJson {
  return block(ctx, 'btp_none', range);
}
function enumBlock(ctx: Ctx, kind: Exclude<EnumKind, 'bool'>, member: string, range: SourceRange): BlockJson {
  const field = kind === 'port' ? 'PORT' : kind === 'direction' ? 'DIRECTION' : kind === 'stop' ? 'STOP' : kind === 'color' ? 'COLOR' : kind === 'button' ? 'BUTTON' : kind === 'side' ? 'SIDE' : 'AXIS';
  return block(ctx, `btp_${kind}`, range, undefined, { [field]: member });
}
function listBlock(ctx: Ctx, items: BlockJson[], range: SourceRange): BlockJson {
  const inputs: NonNullable<BlockJson['inputs']> = {};
  items.forEach((item, index) => { inputs[`ADD${index}`] = { block: item }; });
  return block(ctx, 'lists_create_with', range, undefined, {}, inputs, { itemCount: Math.max(items.length, 0) });
}
function varGet(ctx: Ctx, name: string, range: SourceRange): BlockJson {
  return block(ctx, 'variables_get', range, undefined, { VAR: variableField(ctx.ensureVar(name)) });
}
function varSet(ctx: Ctx, name: string, value: BlockJson, range: SourceRange, comment?: string): BlockJson {
  return block(ctx, 'variables_set', range, comment, { VAR: variableField(ctx.ensureVar(name)) }, { VALUE: { block: value } });
}
function variableField(variable: { id: string; name: string }): { id: string; name: string; type: string } {
  return { id: variable.id, name: variable.name, type: '' };
}
function note(ctx: Ctx, text: string, range: SourceRange, comment?: string): BlockJson {
  return block(ctx, 'btp_note', range, joinComment(comment, text.length > 80 ? text : undefined), { TEXT: snippet(text, 180) });
}
function sourceOf(ctx: Ctx, expr: IrExpr): string {
  return ctx.code.slice(expr.range.start, expr.range.end);
}
function joinComment(...parts: Array<string | undefined>): string | undefined {
  const text = parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part)).join('\n');
  return text || undefined;
}
function blankRange(): SourceRange {
  return { start: 0, end: 0, line: 1, column: 1, endLine: 1, endColumn: 1 };
}

export const REGISTERED_BLOCK_TYPES = BLOCK_SPECS.map((spec) => spec.block);
