export type StartupPhase = 'brand' | 'ownership' | 'app';

export interface StartupState {
  phase: StartupPhase;
  brandStartedAt: number;
  ownershipShownAt: number | null;
  spaceArmed: boolean;
}

/** How long the HAMDAN SYSTEMS screen stays up. */
export const BRAND_DURATION_MS = 5000;

/**
 * Spacebar is ignored for a short moment after the ownership screen appears
 * so a key that was already down cannot skip it by accident.
 */
export const SPACE_ARM_DELAY_MS = 400;

export function createStartup(now: number): StartupState {
  return {
    phase: 'brand',
    brandStartedAt: now,
    ownershipShownAt: null,
    spaceArmed: false,
  };
}

export function tickStartup(state: StartupState, now: number): StartupState {
  if (state.phase === 'brand' && now - state.brandStartedAt >= BRAND_DURATION_MS) {
    return {
      ...state,
      phase: 'ownership',
      ownershipShownAt: now,
      spaceArmed: false,
    };
  }
  if (
    state.phase === 'ownership' &&
    state.ownershipShownAt !== null &&
    !state.spaceArmed &&
    now - state.ownershipShownAt >= SPACE_ARM_DELAY_MS
  ) {
    return { ...state, spaceArmed: true };
  }
  return state;
}

export function isSpaceKey(key: string): boolean {
  return key === ' ' || key === 'Space' || key === 'Spacebar';
}

/** Only an armed, non-repeating Spacebar leaves the ownership screen. */
export function keyStartup(state: StartupState, key: string, repeat: boolean): StartupState {
  if (state.phase !== 'ownership' || !state.spaceArmed || repeat) return state;
  if (!isSpaceKey(key)) return state;
  return { ...state, phase: 'app' };
}
