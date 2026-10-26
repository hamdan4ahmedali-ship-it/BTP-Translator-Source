import * as Blockly from 'blockly';
import type { WorkspaceState } from '../../engine/types';
import { createTheme, createToolbox, registerBlocks } from './blocks';

export interface BlockHost {
  load(state: WorkspaceState): string | null;
  clear(): void;
  fit(): void;
  center(): void;
  resize(): void;
  exportJson(): string;
  hasBlocks(): boolean;
}

export function createBlockHost(host: HTMLElement): BlockHost {
  registerBlocks();
  const workspace = Blockly.inject(host, {
    toolbox: createToolbox(),
    theme: createTheme(),
    renderer: 'zelos',
    media: 'blockly-media/',
    trashcan: true,
    sounds: false,
    zoom: {
      controls: true,
      wheel: true,
      startScale: 0.9,
      maxScale: 2.2,
      minScale: 0.25,
      scaleSpeed: 1.08,
    },
    move: { scrollbars: true, drag: true, wheel: true },
    grid: { spacing: 28, length: 2, colour: '#33363d', snap: false },
  });

  const resize = () => Blockly.svgResize(workspace);

  return {
    load(state) {
      workspace.clear();
      try {
        Blockly.serialization.workspaces.load(state, workspace);
        resize();
        if (workspace.getAllBlocks(false).length > 0) workspace.zoomToFit();
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : 'The blocks could not be drawn.';
      }
    },
    clear() {
      workspace.clear();
    },
    fit() {
      if (workspace.getAllBlocks(false).length > 0) workspace.zoomToFit();
      else workspace.scrollCenter();
    },
    center() {
      workspace.scrollCenter();
    },
    resize,
    exportJson() {
      return JSON.stringify(Blockly.serialization.workspaces.save(workspace), null, 2);
    },
    hasBlocks() {
      return workspace.getAllBlocks(false).length > 0;
    },
  };
}
