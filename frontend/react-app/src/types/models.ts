export type ModelKind = 'case_model' | 'task_model' | 'instrument_model';

export interface ModelListItem {
  id: string;
  kind: ModelKind;
  key: string;
  label: string;
  status: string;
  taskModelId?: string;
  taskModelKey?: string;
}

export interface TaskModelOption {
  id: string;
  key: string;
  label: string;
}
