export const APP_GROUPS = [
  'unassigned',
  'flight_level_0',
  'flight_level_1',
  'flight_level_2',
  'flight_level_3',
] as const;

export type AppGroup = (typeof APP_GROUPS)[number];

export const FLIGHT_LEVEL_GROUPS = [
  'flight_level_0',
  'flight_level_1',
  'flight_level_2',
  'flight_level_3',
] as const;

export type FlightLevelGroup = (typeof FLIGHT_LEVEL_GROUPS)[number];

export interface AppGroupAssignments {
  flight_level_0: string | null;
  flight_level_1: string | null;
  flight_level_2: string | null;
  flight_level_3: string | null;
  unassigned: string[];
}

export const EMPTY_APP_GROUP_ASSIGNMENTS: AppGroupAssignments = {
  flight_level_0: null,
  flight_level_1: null,
  flight_level_2: null,
  flight_level_3: null,
  unassigned: [],
};

export function isAppGroup(value: string): value is AppGroup {
  return (APP_GROUPS as readonly string[]).includes(value);
}

export function isFlightLevelGroup(value: string): value is FlightLevelGroup {
  return (FLIGHT_LEVEL_GROUPS as readonly string[]).includes(value);
}

export function activeAppKeysFromAssignments(assignments: AppGroupAssignments): string[] {
  const keys = new Set<string>(assignments.unassigned);
  for (const group of FLIGHT_LEVEL_GROUPS) {
    const appKey = assignments[group];
    if (appKey) keys.add(appKey);
  }
  return [...keys].sort();
}

export function normalizeAppGroupAssignments(raw: unknown): AppGroupAssignments {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const unassignedRaw = input.unassigned;
  const unassigned = Array.isArray(unassignedRaw)
    ? unassignedRaw.filter((v): v is string => typeof v === 'string')
    : [];

  return {
    flight_level_0: typeof input.flight_level_0 === 'string' ? input.flight_level_0 : null,
    flight_level_1: typeof input.flight_level_1 === 'string' ? input.flight_level_1 : null,
    flight_level_2: typeof input.flight_level_2 === 'string' ? input.flight_level_2 : null,
    flight_level_3: typeof input.flight_level_3 === 'string' ? input.flight_level_3 : null,
    unassigned,
  };
}
