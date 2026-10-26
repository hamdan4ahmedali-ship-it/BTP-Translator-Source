import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../src/examples/programs';
import { convert } from '../src/engine/convert';
import { BLOCK_SPECS } from '../src/engine/registry';

function example(id: string): string {
  const found = EXAMPLES.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found.code;
}

function flat(code: string): string {
  return JSON.stringify(convert(code).workspace);
}

describe('python and pybricks conversion', () => {
  it('translates a motor program', () => {
    const result = convert(example('motor'));
    expect(result.fullyTranslated).toBe(true);
    expect(result.summary).toContain('Fully translated');
    expect(result.blockTypes).toContain('btp_motor_new');
    expect(result.blockTypes).toContain('btp_motor_run');
    expect(result.blockTypes).toContain('btp_wait');
    expect(result.blockTypes).toContain('btp_motor_stop');
    expect(flat(example('motor'))).toContain('example_motor');
    expect(result.preservedComments.join('\n')).toContain('Initialize a motor');
  });

  it('translates DriveBase using arc-era signatures', () => {
    const result = convert(example('drivebase'));
    expect(result.fullyTranslated).toBe(true);
    expect(result.blockTypes).toContain('btp_drivebase_new');
    expect(result.blockTypes).toContain('btp_db_straight');
    expect(result.blockTypes).toContain('btp_db_turn');
    expect(flat(example('drivebase'))).toContain('COUNTERCLOCKWISE');
  });

  it('keeps DriveBase.curve as source and names arc', () => {
    const result = convert('drive_base.curve(100, 90)\n');
    expect(result.fullyTranslated).toBe(false);
    expect(result.diagnostics.some((item) => item.message.includes('arc'))).toBe(true);
    expect(flat('drive_base.curve(100, 90)\n')).toContain('curve');
  });

  it('translates variables and arithmetic', () => {
    const result = convert(example('variables'));
    expect(result.fullyTranslated).toBe(true);
    expect(result.blockTypes).toContain('variables_set');
    expect(result.blockTypes).toContain('math_arithmetic');
    expect(result.blockTypes).toContain('logic_operation');
    expect(result.blockTypes).toContain('controls_if');
  });

  it('translates nested if, elif, and else', () => {
    const result = convert(example('nested-if'));
    expect(result.fullyTranslated).toBe(true);
    expect(result.blockTypes.filter((type) => type === 'controls_if').length).toBeGreaterThan(1);
    const text = flat(example('nested-if'));
    expect(text).toContain('elseIfCount');
    expect(text).toContain('hasElse');
  });

  it('translates for and while loops, including an exclusive range end', () => {
    const result = convert(example('loops'));
    expect(result.fullyTranslated).toBe(true);
    expect(result.blockTypes).toContain('controls_for');
    expect(result.blockTypes).toContain('controls_whileUntil');
    expect(result.blockTypes).toContain('controls_flow_statements');
    const text = flat('for i in range(10):\n    pass\n');
    expect(text).toContain('"NUM":9');
    expect(text).toContain('"NUM":0');
  });

  it('translates functions, calls, and return', () => {
    const result = convert(example('functions'));
    expect(result.fullyTranslated).toBe(true);
    expect(result.blockTypes).toContain('btp_function');
    expect(result.blockTypes).toContain('btp_call_value');
    expect(result.blockTypes).toContain('btp_return_value');
  });

  it('preserves comments and docstrings', () => {
    const result = convert(example('comments'));
    expect(result.fullyTranslated).toBe(true);
    const text = JSON.stringify(result.workspace) + result.preservedComments.join('\n');
    expect(text).toContain('Module note');
    expect(text).toContain('Turn the motor one full rotation');
    expect(text).toContain('360 degrees');
  });

  it('translates async multitask programs', () => {
    const result = convert(example('async'));
    expect(result.fullyTranslated).toBe(true);
    expect(result.blockTypes).toContain('btp_async_function');
    expect(result.blockTypes).toContain('btp_multitask');
    expect(result.blockTypes).toContain('btp_run_task');
    expect(result.blockTypes).toContain('btp_motor_run_angle');
  });

  it('does not drop unsupported syntax or claim a full translation', () => {
    const result = convert(example('unsupported'));
    expect(result.fullyTranslated).toBe(false);
    expect(result.summary.toLowerCase()).not.toContain('fully translated');
    const text = flat(example('unsupported'));
    expect(text).toContain('class Robot');
    expect(text).toContain('lambda');
    expect(result.diagnostics.some((item) => item.message.includes('Class definitions'))).toBe(true);
    expect(result.diagnostics.some((item) => item.message.includes('try/except'))).toBe(true);
    expect(result.diagnostics.some((item) => item.message.includes('lambda'))).toBe(true);
  });

  it('reports a syntax error without throwing', () => {
    const result = convert('def (\n');
    expect(result.fullyTranslated).toBe(false);
    expect(result.diagnostics.some((item) => item.severity === 'error')).toBe(true);
    expect(result.summary).toContain('not changed');
  });

  it('repairs not/and precedence and chained comparisons', () => {
    const logic = convert('ready = not True and False\n');
    expect(logic.fullyTranslated).toBe(true);
    expect(logic.blockTypes).toContain('logic_negate');
    expect(logic.blockTypes).toContain('logic_operation');
    const text = flat('ready = not True and False\n');
    expect(text.indexOf('logic_operation')).toBeLessThan(text.indexOf('logic_negate'));
    const chain = convert('ok = 0 < x < 10\n');
    expect(chain.fullyTranslated).toBe(true);
    expect(chain.blockTypes.filter((type) => type === 'logic_compare')).toHaveLength(2);
    expect(chain.blockTypes).toContain('logic_operation');
  });

  it('translates sensors, the hub, and an augmented assignment', () => {
    expect(convert(example('sensors')).fullyTranslated).toBe(true);
    expect(convert(example('hub')).fullyTranslated).toBe(true);
    const update = convert('speed += 25\n');
    expect(update.fullyTranslated).toBe(true);
    expect(update.blockTypes).toContain('math_arithmetic');
  });

  it('documents motor speed in deg/s and straight distance in mm', () => {
    const run = BLOCK_SPECS.find((spec) => spec.key === 'Motor.run');
    const straight = BLOCK_SPECS.find((spec) => spec.key === 'DriveBase.straight');
    const arc = BLOCK_SPECS.find((spec) => spec.key === 'DriveBase.arc');
    const wait = BLOCK_SPECS.find((spec) => spec.key === 'func:wait');
    expect(run?.tooltip).toContain('degrees per second');
    expect(straight?.tooltip).toContain('millimetres');
    expect(arc?.params.map((param) => param.name)).toEqual(['radius', 'angle', 'distance', 'then', 'wait']);
    expect(wait?.tooltip).toContain('milliseconds');
    expect(BLOCK_SPECS.some((spec) => spec.key === 'DriveBase.curve')).toBe(false);
  });
});
