export interface OpenSuccess {
  canceled: false;
  path: string;
  content: string;
}

export interface SaveSuccess {
  canceled: false;
  path: string;
}

export interface FileCanceled {
  canceled: true;
  message?: string;
}

export type OpenResult = OpenSuccess | FileCanceled;
export type SaveResult = SaveSuccess | FileCanceled;

export interface SaveRequest {
  path: string | null;
  content: string;
  suggestedName: string;
}

export interface ExportRequest {
  content: string;
  suggestedName: string;
}

export type AppCommand =
  | 'new'
  | 'open'
  | 'save'
  | 'save-as'
  | 'export'
  | 'translate'
  | 'fit'
  | 'reset'
  | 'help'
  | 'about'
  | 'settings';
