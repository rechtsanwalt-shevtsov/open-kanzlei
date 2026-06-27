import { useEffect, useRef, useState } from 'react';
import type { AppGroupAssignments } from './useAppAssignments.js';

interface AutoSaveRowState {
  assignments: AppGroupAssignments;
  saving: boolean;
}

export type SaveAssignmentsResult =
  | { ok: true; assignments: AppGroupAssignments }
  | { ok: false; error: string };

export function useAutoSaveAssignmentRow(
  serverAssignments: AppGroupAssignments,
  rowKey: string,
  onSave: (assignments: AppGroupAssignments) => Promise<SaveAssignmentsResult>,
) {
  const [state, setState] = useState<AutoSaveRowState>({
    assignments: serverAssignments,
    saving: false,
  });
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const saveSeqRef = useRef(0);
  const assignmentsRef = useRef(serverAssignments);

  assignmentsRef.current = state.assignments;

  useEffect(() => {
    if (savingRef.current) return;
    assignmentsRef.current = serverAssignments;
    setState({ assignments: serverAssignments, saving: false });
    setError(null);
  }, [serverAssignments, rowKey]);

  async function persist(next: AppGroupAssignments) {
    const seq = ++saveSeqRef.current;
    assignmentsRef.current = next;
    setState({ assignments: next, saving: true });
    setError(null);
    savingRef.current = true;

    const result = await onSave(next);

    if (seq !== saveSeqRef.current) return;

    savingRef.current = false;

    if (!result.ok) {
      setError(result.error);
      assignmentsRef.current = serverAssignments;
      setState({ assignments: serverAssignments, saving: false });
      return;
    }

    assignmentsRef.current = result.assignments;
    setState({ assignments: result.assignments, saving: false });
    setError(null);
  }

  function updateAssignments(next: AppGroupAssignments) {
    void persist(next);
  }

  function patchAssignments(patch: Partial<AppGroupAssignments>) {
    const next: AppGroupAssignments = {
      ...assignmentsRef.current,
      ...patch,
    };
    void persist(next);
  }

  return {
    assignments: state.assignments,
    saving: state.saving,
    error,
    updateAssignments,
    patchAssignments,
  };
}
