import { useMemo } from 'react';
import { FieldSelectInput } from './FieldSelectInput.js';
import { useI18n } from '../../i18n/I18nContext.js';
import type { AppCatalogItem, AppGroupAssignments } from '../../hooks/useAppAssignments.js';

const FLIGHT_LEVELS = [
  'flight_level_0',
  'flight_level_1',
  'flight_level_2',
  'flight_level_3',
] as const;

type FlightLevel = (typeof FLIGHT_LEVELS)[number];

interface AppAssignmentCellsProps {
  apps: AppCatalogItem[];
  assignments: AppGroupAssignments;
  disabled?: boolean;
  onPatch: (patch: Partial<AppGroupAssignments>) => void;
}

function appsForGroup(apps: AppCatalogItem[], group: string): AppCatalogItem[] {
  return apps.filter((app) => app.app_group === group);
}

function appLabels(apps: AppCatalogItem[]): Record<string, string> {
  return Object.fromEntries(apps.map((app) => [app.app_key, app.name]));
}

export function AppAssignmentCells({
  apps,
  assignments,
  disabled = false,
  onPatch,
}: AppAssignmentCellsProps) {
  const { msg } = useI18n();
  const unassignedApps = useMemo(() => appsForGroup(apps, 'unassigned'), [apps]);
  const labels = useMemo(() => appLabels(apps), [apps]);

  function updateFlightLevel(level: FlightLevel, value: string | string[] | null) {
    onPatch({
      [level]: typeof value === 'string' ? value : null,
    });
  }

  function updateUnassigned(value: string | string[] | null) {
    onPatch({
      unassigned: Array.isArray(value) ? value : [],
    });
  }

  return (
    <>
      {FLIGHT_LEVELS.map((level) => {
        const options = appsForGroup(apps, level).map((app) => app.app_key);
        return (
          <td key={level}>
            <FieldSelectInput
              dataType="single_select"
              options={options}
              optionLabels={labels}
              value={assignments[level] ?? ''}
              disabled={disabled}
              className="admin-settings-select"
              onChange={(value: string | string[] | null) => updateFlightLevel(level, value)}
            />
          </td>
        );
      })}
      <td>
        <FieldSelectInput
          dataType="multi_select"
          options={unassignedApps.map((app) => app.app_key)}
          optionLabels={labels}
          value={assignments.unassigned}
          disabled={disabled}
          compact
          onChange={(value: string | string[] | null) => updateUnassigned(value)}
        />
        {unassignedApps.length === 0 && (
          <span className="admin-table-muted">{msg('adminAppsNoUnassigned')}</span>
        )}
      </td>
    </>
  );
}
