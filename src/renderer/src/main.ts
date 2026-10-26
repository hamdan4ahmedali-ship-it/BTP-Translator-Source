import { BRAND_DURATION_MS, SPACE_ARM_DELAY_MS, createStartup, isSpaceKey, keyStartup, tickStartup, type StartupState } from '../../engine/startup';
import { mountApp } from './app';
import './styles.css';

const brand = document.querySelector<HTMLElement>('#brand');
const ownership = document.querySelector<HTMLElement>('#ownership');
const app = document.querySelector<HTMLElement>('#app');

let state: StartupState = createStartup(performance.now());
let mounted = false;

function render(): void {
  if (!brand || !ownership || !app) return;
  brand.hidden = state.phase !== 'brand';
  ownership.hidden = state.phase !== 'ownership';
  app.hidden = state.phase !== 'app';
  if (state.phase === 'ownership') {
    ownership.tabIndex = -1;
    ownership.focus();
    window.btp?.focusWindow();
  }
  if (state.phase === 'app' && !mounted) {
    mounted = true;
    mountApp();
    window.btp?.startupDone();
  }
}

function armTimer(): void {
  const now = performance.now();
  state = tickStartup(state, now);
  render();
  if (state.phase === 'app') return;
  let delay = 250;
  if (state.phase === 'brand') delay = Math.max(0, state.brandStartedAt + BRAND_DURATION_MS - now);
  else if (state.ownershipShownAt !== null && !state.spaceArmed) delay = Math.max(0, state.ownershipShownAt + SPACE_ARM_DELAY_MS - now);
  else return;
  window.setTimeout(armTimer, delay);
}

function skip(repeat: boolean, key: string, code: string): void {
  state = tickStartup(state, performance.now());
  if (state.phase !== 'ownership') return;
  if (!isSpaceKey(key) && code !== 'Space') return;
  const next = keyStartup(state, ' ', repeat);
  if (next === state) return;
  state = next;
  render();
}

window.addEventListener('keydown', (event) => {
  if (state.phase !== 'ownership') return;
  if (!isSpaceKey(event.key) && event.code !== 'Space') return;
  event.preventDefault();
  skip(event.repeat, event.key, event.code);
});
window.btp?.onSpace(() => {
  if (state.phase !== 'ownership') return;
  skip(false, ' ', 'Space');
});

render();
armTimer();
