import { emit } from './emit';
import { lower } from './lower';
import type { BlockJson, ConversionResult, Diagnostic } from './types';

export function convert(code: string): ConversionResult {
  try {
    const source = code.replace(/\r\n/g, '\n');
    const lowered = lower(source);
    const emitted = emit(source, lowered);
    const diagnostics = emitted.diagnostics;
    const errors = diagnostics.filter((item) => item.severity === 'error').length;
    const warnings = diagnostics.filter((item) => item.severity === 'warning').length;
    const unsupported = diagnostics.filter((item) => item.code === 'unsupported' || item.severity === 'warning').length;
    const empty = source.trim().length === 0 || (emitted.blockTypes.length === 0 && warnings === 0 && errors === 0);
    const fullyTranslated = !empty && errors === 0 && warnings === 0;
    return {
      fullyTranslated,
      empty,
      summary: summaryFor(fullyTranslated, empty, warnings, errors),
      diagnostics,
      workspace: emitted.workspace,
      preservedComments: emitted.preservedComments,
      blockTypes: emitted.blockTypes,
      stats: { blocks: countBlocks(emitted.workspace.blocks.blocks), warnings, errors, unsupported },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown translation error';
    const diagnostic: Diagnostic = {
      severity: 'error',
      code: 'internal',
      message: `Translation stopped because of an internal error (${message}). Your Python code was not changed.`,
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 1,
    };
    return {
      fullyTranslated: false,
      empty: false,
      summary: 'Translation failed. Your Python code was not changed.',
      diagnostics: [diagnostic],
      workspace: { blocks: { languageVersion: 0, blocks: [] }, variables: [] },
      preservedComments: [],
      blockTypes: [],
      stats: { blocks: 0, warnings: 0, errors: 1, unsupported: 0 },
    };
  }
}

function summaryFor(fullyTranslated: boolean, empty: boolean, warnings: number, errors: number): string {
  if (empty) return 'There is no Python code to translate yet.';
  if (errors > 0) return 'Translation finished with errors. Your Python code was not changed.';
  if (!fullyTranslated) {
    return `Translated with ${warnings} warning${warnings === 1 ? '' : 's'}. Some syntax could not become native blocks and was kept in the workspace.`;
  }
  return 'Fully translated into Blockly blocks.';
}

function countBlocks(blocks: BlockJson[]): number {
  return blocks.reduce((sum, block) => sum + countOne(block), 0);
}

function countOne(block: BlockJson): number {
  let count = 1;
  if (block.next?.block) count += countOne(block.next.block);
  for (const input of Object.values(block.inputs ?? {})) {
    if (input.block) count += countOne(input.block);
  }
  return count;
}

export function workspaceText(result: ConversionResult): string {
  return JSON.stringify(result.workspace, null, 2);
}
