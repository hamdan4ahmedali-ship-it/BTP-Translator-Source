export interface SourceRange {
  start: number;
  end: number;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  severity: DiagnosticSeverity;
  message: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  code: string;
}

export interface IrArg {
  name?: string;
  value: IrExpr;
}

export type IrExpr =
  | { kind: 'number'; value: number; raw: string; range: SourceRange }
  | { kind: 'string'; value: string; bytes: boolean; range: SourceRange }
  | { kind: 'bool'; value: boolean; range: SourceRange }
  | { kind: 'none'; range: SourceRange }
  | { kind: 'name'; name: string; range: SourceRange }
  | { kind: 'list'; items: IrExpr[]; tuple: boolean; range: SourceRange }
  | { kind: 'binary'; op: string; left: IrExpr; right: IrExpr; range: SourceRange }
  | { kind: 'unary'; op: string; expr: IrExpr; range: SourceRange }
  | { kind: 'call'; callee: IrExpr; args: IrArg[]; range: SourceRange }
  | { kind: 'attr'; object: IrExpr; name: string; range: SourceRange }
  | { kind: 'index'; object: IrExpr; index: IrExpr; range: SourceRange }
  | { kind: 'conditional'; test: IrExpr; thenExpr: IrExpr; elseExpr: IrExpr; range: SourceRange }
  | { kind: 'await'; expr: IrExpr; range: SourceRange }
  | { kind: 'unsupported'; source: string; reason: string; range: SourceRange };

export interface ImportBinding {
  module: string;
  imported: string | null;
  local: string;
}

export type IrStmt =
  | { kind: 'assign'; targets: string[]; value: IrExpr; range: SourceRange; comment?: string }
  | { kind: 'augAssign'; target: string; op: string; value: IrExpr; range: SourceRange; comment?: string }
  | { kind: 'expr'; expr: IrExpr; range: SourceRange; comment?: string }
  | { kind: 'doc'; text: string; range: SourceRange; comment?: string }
  | {
      kind: 'if';
      test: IrExpr;
      body: IrStmt[];
      elifs: { test: IrExpr; body: IrStmt[] }[];
      elseBody: IrStmt[] | null;
      range: SourceRange;
      comment?: string;
    }
  | { kind: 'while'; test: IrExpr; body: IrStmt[]; range: SourceRange; comment?: string }
  | { kind: 'for'; target: string; iter: IrExpr; body: IrStmt[]; range: SourceRange; comment?: string }
  | {
      kind: 'func';
      name: string;
      params: string[];
      defaults: string[];
      body: IrStmt[];
      async: boolean;
      docstring?: string;
      range: SourceRange;
      comment?: string;
    }
  | { kind: 'return'; value: IrExpr | null; range: SourceRange; comment?: string }
  | { kind: 'break'; range: SourceRange; comment?: string }
  | { kind: 'continue'; range: SourceRange; comment?: string }
  | { kind: 'pass'; range: SourceRange; comment?: string }
  | { kind: 'import'; source: string; names: ImportBinding[]; range: SourceRange; comment?: string }
  | { kind: 'unsupported'; source: string; reason: string; range: SourceRange; comment?: string };

export interface BlockJson {
  type: string;
  id?: string;
  x?: number;
  y?: number;
  fields?: Record<string, string | number | boolean | { id: string; name?: string; type?: string }>;
  inputs?: Record<string, { block?: BlockJson }>;
  next?: { block: BlockJson };
  extraState?: Record<string, unknown>;
  data?: string;
  icons?: {
    comment?: {
      text: string;
      pinned: boolean;
      height: number;
      width: number;
    };
  };
}

export interface WorkspaceState {
  blocks: {
    languageVersion: number;
    blocks: BlockJson[];
  };
  variables: { name: string; id: string; type: string }[];
}

export interface ConversionResult {
  fullyTranslated: boolean;
  empty: boolean;
  summary: string;
  diagnostics: Diagnostic[];
  workspace: WorkspaceState;
  preservedComments: string[];
  blockTypes: string[];
  stats: {
    blocks: number;
    warnings: number;
    errors: number;
    unsupported: number;
  };
}
