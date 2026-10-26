import * as Blockly from 'blockly';
import 'blockly/blocks';
import { BLOCK_SPECS, ENUM_OPTIONS, definitionFromSpec, type CategoryName } from '../../engine/registry';

interface CountBlock extends Blockly.Block {
  count_: number;
  updateShape_: () => void;
}

const ARG_MUTATOR = {
  count_: 0,
  saveExtraState(this: CountBlock) {
    return { argCount: this.count_ };
  },
  loadExtraState(this: CountBlock, state: { argCount?: number }) {
    this.count_ = state?.argCount ?? 0;
    this.updateShape_();
  },
  updateShape_(this: CountBlock) {
    let index = 0;
    while (this.getInput(`ARG${index}`)) {
      this.removeInput(`ARG${index}`);
      index += 1;
    }
    for (let slot = 0; slot < this.count_; slot += 1) {
      this.appendValueInput(`ARG${slot}`).appendField(slot === 0 ? 'with' : ',');
    }
  },
};

const TASK_MUTATOR = {
  count_: 1,
  saveExtraState(this: CountBlock) {
    return { taskCount: this.count_ };
  },
  loadExtraState(this: CountBlock, state: { taskCount?: number }) {
    this.count_ = Math.max(state?.taskCount ?? 1, 1);
    this.updateShape_();
  },
  updateShape_(this: CountBlock) {
    let index = 0;
    while (this.getInput(`TASK${index}`)) {
      this.removeInput(`TASK${index}`);
      index += 1;
    }
    for (let slot = 0; slot < this.count_; slot += 1) {
      this.appendStatementInput(`TASK${slot}`).appendField(`task ${slot + 1}`);
    }
  },
};

let registered = false;

export function registerBlocks(): void {
  if (registered) return;
  registered = true;
  Blockly.Extensions.registerMutator('btp_args_mutator', ARG_MUTATOR);
  Blockly.Extensions.registerMutator('btp_tasks_mutator', TASK_MUTATOR);
  const seen = new Set<string>();
  const specs = BLOCK_SPECS.filter((spec) => {
    if (seen.has(spec.block)) return false;
    seen.add(spec.block);
    return true;
  }).map((spec) => ({ ...definitionFromSpec(spec), helpUrl: spec.docs }));
  Blockly.defineBlocksWithJsonArray([...specs, ...pythonBlocks()]);
}

function dropdown(name: string, options: string[]): Record<string, unknown> {
  return { type: 'field_dropdown', name, options: options.map((option) => [option, option]) };
}

function pythonBlocks(): Record<string, unknown>[] {
  const statement = { previousStatement: null, nextStatement: null };
  return [
    { type: 'btp_pass', message0: 'pass', colour: 60, tooltip: 'This line does nothing.', ...statement },
    { type: 'btp_note', message0: 'note %1', args0: [{ type: 'field_input', name: 'TEXT', text: 'note' }], colour: 45, tooltip: 'A comment or docstring from the Python program.', ...statement },
    { type: 'btp_import', message0: 'import %1', args0: [{ type: 'field_input', name: 'TEXT', text: 'module' }], colour: 200, tooltip: 'An import kept from the Python file.', ...statement },
    { type: 'btp_unsupported', message0: 'kept source %1', args0: [{ type: 'field_input', name: 'TEXT', text: 'code' }], colour: 0, tooltip: 'Python that could not become a native block. The original line is still here.', ...statement },
    { type: 'btp_unsupported_value', message0: 'kept source %1', args0: [{ type: 'field_input', name: 'TEXT', text: 'code' }], colour: 0, output: null, tooltip: 'An expression that could not become a native block.' },
    { type: 'btp_do', message0: 'use value %1', args0: [{ type: 'input_value', name: 'VALUE' }], colour: 290, tooltip: 'Runs a value block as its own step.', ...statement },
    { type: 'btp_none', message0: 'None', colour: 210, output: null, tooltip: 'Python None.' },
    { type: 'btp_named_constant', message0: 'constant %1', args0: [{ type: 'field_input', name: 'TEXT', text: 'NAME' }], colour: 160, output: null, tooltip: 'A name such as Color.RED that is not a dropdown yet.' },
    { type: 'btp_port', message0: 'port %1', args0: [dropdown('PORT', ENUM_OPTIONS.port)], colour: 160, output: null, tooltip: 'A Pybricks motor or sensor port.' },
    { type: 'btp_direction', message0: 'direction %1', args0: [dropdown('DIRECTION', ENUM_OPTIONS.direction)], colour: 160, output: null, tooltip: 'Which way positive motor speed turns.' },
    { type: 'btp_stop', message0: 'stop %1', args0: [dropdown('STOP', ENUM_OPTIONS.stop)], colour: 160, output: null, tooltip: 'How a motor or drive base stops: hold, brake, or coast.' },
    { type: 'btp_color', message0: 'color %1', args0: [dropdown('COLOR', ENUM_OPTIONS.color)], colour: 20, output: null, tooltip: 'A Pybricks color.' },
    { type: 'btp_button', message0: 'button %1', args0: [dropdown('BUTTON', ENUM_OPTIONS.button)], colour: 45, output: null, tooltip: 'A hub button.' },
    { type: 'btp_side', message0: 'side %1', args0: [dropdown('SIDE', ENUM_OPTIONS.side)], colour: 45, output: null, tooltip: 'A side of the hub.' },
    { type: 'btp_axis', message0: 'axis %1', args0: [dropdown('AXIS', ENUM_OPTIONS.axis)], colour: 45, output: null, tooltip: 'A hub axis.' },
    { type: 'btp_function', message0: 'define %1 ( %2 )', args0: [{ type: 'field_input', name: 'NAME', text: 'name' }, { type: 'field_input', name: 'PARAMS', text: '' }], message1: '%1', args1: [{ type: 'input_statement', name: 'BODY' }], colour: 290, tooltip: 'A Python function. Editing this block does not change the Python file.', ...statement },
    { type: 'btp_async_function', message0: 'async define %1 ( %2 )', args0: [{ type: 'field_input', name: 'NAME', text: 'name' }, { type: 'field_input', name: 'PARAMS', text: '' }], message1: '%1', args1: [{ type: 'input_statement', name: 'BODY' }], colour: 290, tooltip: 'An async function used with Pybricks multitasking.', ...statement },
    { type: 'btp_call', message0: 'call %1', args0: [{ type: 'field_input', name: 'NAME', text: 'name' }], mutator: 'btp_args_mutator', colour: 290, tooltip: 'Call a function from this program.', ...statement },
    { type: 'btp_call_value', message0: 'call %1', args0: [{ type: 'field_input', name: 'NAME', text: 'name' }], mutator: 'btp_args_mutator', colour: 290, output: null, tooltip: 'Call a function and use its return value.' },
    { type: 'btp_return', message0: 'return', colour: 290, tooltip: 'Return from a function.', ...statement },
    { type: 'btp_return_value', message0: 'return %1', args0: [{ type: 'input_value', name: 'VALUE' }], colour: 290, tooltip: 'Return a value from a function.', ...statement },
    { type: 'btp_for_range', message0: 'for %1 in range( %2 , %3 , %4 )', args0: [{ type: 'field_input', name: 'VAR', text: 'i' }, { type: 'input_value', name: 'START' }, { type: 'input_value', name: 'STOP' }, { type: 'input_value', name: 'STEP' }], message1: '%1', args1: [{ type: 'input_statement', name: 'BODY' }], colour: 120, tooltip: 'A Python range loop. Stop is exclusive, as in Python.', ...statement },
    { type: 'btp_in', message0: '%1 in %2', args0: [{ type: 'input_value', name: 'A' }, { type: 'input_value', name: 'B' }], colour: 210, output: 'Boolean', inputsInline: true, tooltip: 'True when the value is in the collection.' },
    { type: 'btp_not_in', message0: '%1 not in %2', args0: [{ type: 'input_value', name: 'A' }, { type: 'input_value', name: 'B' }], colour: 210, output: 'Boolean', inputsInline: true, tooltip: 'True when the value is not in the collection.' },
    { type: 'btp_is', message0: '%1 is %2', args0: [{ type: 'input_value', name: 'A' }, { type: 'input_value', name: 'B' }], colour: 210, output: 'Boolean', inputsInline: true, tooltip: 'Python identity comparison.' },
    { type: 'btp_is_not', message0: '%1 is not %2', args0: [{ type: 'input_value', name: 'A' }, { type: 'input_value', name: 'B' }], colour: 210, output: 'Boolean', inputsInline: true, tooltip: 'Python identity comparison.' },
    { type: 'btp_floor_div', message0: '%1 // %2', args0: [{ type: 'input_value', name: 'A' }, { type: 'input_value', name: 'B' }], colour: 230, output: 'Number', inputsInline: true, tooltip: 'Floor division.' },
    { type: 'btp_index', message0: 'item %1 of %2', args0: [{ type: 'input_value', name: 'ITEM' }, { type: 'input_value', name: 'LIST' }], colour: 260, output: null, inputsInline: true, tooltip: 'Read one item from a list.' },
    { type: 'btp_conditional', message0: '%1 if %2 else %3', args0: [{ type: 'input_value', name: 'THEN' }, { type: 'input_value', name: 'TEST' }, { type: 'input_value', name: 'ELSE' }], colour: 210, output: null, inputsInline: true, tooltip: 'A Python conditional expression.' },
    { type: 'btp_list_append', message0: 'add %1 to list %2', args0: [{ type: 'input_value', name: 'ITEM' }, { type: 'field_input', name: 'LIST', text: 'items' }], colour: 260, tooltip: 'Append an item to a list.', ...statement },
    { type: 'btp_abs', message0: 'abs %1', args0: [{ type: 'input_value', name: 'VALUE' }], colour: 230, output: 'Number', tooltip: 'Absolute value.' },
    { type: 'btp_min', message0: 'min of %1 and %2', args0: [{ type: 'input_value', name: 'A' }, { type: 'input_value', name: 'B' }], colour: 230, output: 'Number', inputsInline: true, tooltip: 'The smaller value.' },
    { type: 'btp_max', message0: 'max of %1 and %2', args0: [{ type: 'input_value', name: 'A' }, { type: 'input_value', name: 'B' }], colour: 230, output: 'Number', inputsInline: true, tooltip: 'The larger value.' },
    { type: 'btp_int', message0: 'int %1', args0: [{ type: 'input_value', name: 'VALUE' }], colour: 230, output: 'Number', tooltip: 'Convert a value to an integer.' },
    { type: 'btp_str', message0: 'str %1', args0: [{ type: 'input_value', name: 'VALUE' }], colour: 160, output: 'String', tooltip: 'Convert a value to text.' },
    { type: 'btp_negative', message0: '- %1', args0: [{ type: 'input_value', name: 'VALUE' }], colour: 230, output: 'Number', tooltip: 'Negate a value.' },
    { type: 'btp_multitask', message0: 'multitask', mutator: 'btp_tasks_mutator', colour: 190, tooltip: 'Run the tasks at the same time. This is Pybricks multitask().', ...statement },
    { type: 'btp_run_task', message0: 'run task %1', args0: [{ type: 'input_value', name: 'TASK' }], colour: 190, tooltip: 'Start an async task with run_task().', ...statement },
  ];
}

const CATEGORY_COLOURS: Record<CategoryName, string> = {
  Motors: '#5c81a6',
  'Drive base': '#5ca65c',
  Sensors: '#5c68a6',
  Hub: '#a65c5c',
  Timing: '#a68c5c',
  Pybricks: '#5c81a6',
  Notes: '#745ca6',
  Functions: '#995ba5',
};

export function createTheme(): Blockly.Theme {
  return Blockly.Theme.defineTheme('btpDark', {
    name: 'btpDark',
    base: Blockly.Themes.Zelos,
    componentStyles: {
      workspaceBackgroundColour: '#1e1e1e',
      toolboxBackgroundColour: '#252526',
      toolboxForegroundColour: '#d7dbe2',
      flyoutBackgroundColour: '#2a2d31',
      flyoutForegroundColour: '#d7dbe2',
      scrollbarColour: '#4a5160',
      insertionMarkerColour: '#4fc1ff',
      insertionMarkerOpacity: 0.45,
      selectedGlowColour: '#4fc1ff',
      cursorColour: '#4fc1ff',
    },
    fontStyle: { family: 'Segoe UI, sans-serif', size: 12 },
  });
}

export function createToolbox(): Blockly.utils.toolbox.ToolboxInfo {
  const contents: Blockly.utils.toolbox.ToolboxItemInfo[] = [
    category('Logic', '#5b80a5', [
      block('controls_if'),
      block('logic_compare'),
      block('logic_operation'),
      block('logic_negate'),
      block('logic_boolean'),
      block('btp_in'),
      block('btp_not_in'),
      block('btp_is'),
      block('btp_is_not'),
      block('btp_conditional'),
    ]),
    category('Loops', '#5ca65c', [
      block('controls_whileUntil'),
      block('controls_for'),
      block('controls_forEach'),
      block('btp_for_range'),
      block('controls_flow_statements'),
    ]),
    category('Math', '#5c68a6', [
      block('math_number'),
      block('math_arithmetic'),
      block('math_modulo'),
      block('btp_floor_div'),
      block('btp_negative'),
      block('btp_abs'),
      block('btp_min'),
      block('btp_max'),
      block('btp_int'),
    ]),
    category('Text', '#5ca68c', [block('text'), block('text_print'), block('text_join'), block('btp_str')]),
    category('Lists', '#745ca6', [block('lists_create_with'), block('lists_length'), block('btp_list_append'), block('btp_index')]),
    { kind: 'category', name: 'Variables', custom: 'VARIABLE', colour: '#a65c81' } as Blockly.utils.toolbox.ToolboxItemInfo,
    category('Functions', '#995ba5', [
      block('btp_function'),
      block('btp_async_function'),
      { kind: 'block', type: 'btp_call', extraState: { argCount: 1 } },
      { kind: 'block', type: 'btp_call_value', extraState: { argCount: 1 } },
      block('btp_return'),
      block('btp_return_value'),
    ]),
    specCategory('Hub', 'Pybricks'),
    specCategory('Motors', 'Motors'),
    specCategory('Drive base', 'DriveBase'),
    specCategory('Sensors', 'Sensors'),
    specCategory('Timing', 'Timing'),
    category('Advanced', '#745ca6', [
      block('btp_note'),
      block('btp_import'),
      block('btp_pass'),
      block('btp_none'),
      block('btp_named_constant'),
      block('btp_port'),
      block('btp_direction'),
      block('btp_stop'),
      block('btp_color'),
      block('btp_button'),
      block('btp_side'),
      block('btp_axis'),
      block('btp_do'),
      block('btp_unsupported'),
      block('btp_multitask'),
      block('btp_run_task'),
    ]),
  ];
  return { kind: 'categoryToolbox', contents };
}

function category(name: string, colour: string, contents: Blockly.utils.toolbox.FlyoutItemInfo[]): Blockly.utils.toolbox.ToolboxItemInfo {
  return { kind: 'category', name, colour, contents } as Blockly.utils.toolbox.ToolboxItemInfo;
}

function block(type: string): Blockly.utils.toolbox.FlyoutItemInfo {
  return { kind: 'block', type };
}

function specCategory(categoryName: CategoryName, label: string): Blockly.utils.toolbox.ToolboxItemInfo {
  const seen = new Set<string>();
  const contents = BLOCK_SPECS.filter((spec) => spec.category === categoryName).flatMap((spec) => {
    if (seen.has(spec.block)) return [];
    seen.add(spec.block);
    return [block(spec.block)];
  });
  return category(label, CATEGORY_COLOURS[categoryName], contents);
}
