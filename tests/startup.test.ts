import { describe, expect, it } from 'vitest';
import { BRAND_DURATION_MS, SPACE_ARM_DELAY_MS, createStartup, keyStartup, tickStartup } from '../src/engine/startup';

describe('startup sequence', () => {
  it('shows the brand screen for exactly five seconds', () => {
    let state = createStartup(0);
    state = tickStartup(state, BRAND_DURATION_MS - 1);
    expect(state.phase).toBe('brand');
    state = tickStartup(state, BRAND_DURATION_MS);
    expect(state.phase).toBe('ownership');
  });

  it('does not skip the ownership screen on a timer', () => {
    let state = tickStartup(createStartup(0), BRAND_DURATION_MS);
    state = tickStartup(state, BRAND_DURATION_MS + 60_000);
    expect(state.phase).toBe('ownership');
  });

  it('ignores Spacebar until the screen is armed, then accepts only Spacebar', () => {
    let state = tickStartup(createStartup(0), BRAND_DURATION_MS);
    state = keyStartup(state, ' ', false);
    expect(state.phase).toBe('ownership');
    state = tickStartup(state, BRAND_DURATION_MS + SPACE_ARM_DELAY_MS);
    expect(state.spaceArmed).toBe(true);
    state = keyStartup(state, 'Enter', false);
    expect(state.phase).toBe('ownership');
    state = keyStartup(state, ' ', true);
    expect(state.phase).toBe('ownership');
    state = keyStartup(state, ' ', false);
    expect(state.phase).toBe('app');
  });

  it('ignores Spacebar during the brand screen', () => {
    const state = keyStartup(createStartup(0), 'Space', false);
    expect(state.phase).toBe('brand');
  });
});
