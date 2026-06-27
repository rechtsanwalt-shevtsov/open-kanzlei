export type ModelKind = 'case_model' | 'actor_model';

export interface ModelListItem {
  id: string;
  kind: ModelKind;
  key: string;
  label: string;
  status: string;
}
