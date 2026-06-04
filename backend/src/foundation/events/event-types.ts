/**
 * Canonical event type registry.
 * Public types may be subscribed to by apps and webhooks.
 * Internal types are for platform processes only.
 */

export const PUBLIC_EVENT_TYPES = [
  // Platform — tenant & users
  'tenant.registered',
  'tenant_profile.updated',
  'user.created',
  'user.updated',
  // Apps
  'app.installed',
  'app.activated',
  'app.deactivated',
  'app_settings.updated',
  // Legal — models
  'case_model.created',
  'case_model.updated',
  'case_model.archived',
  'case_model.deleted',
  'attribute_definition.created',
  'attribute_definition.updated',
  'attribute_definition.deleted',
  'task_model.created',
  'task_model.updated',
  'task_model.deleted',
  'instrument_model.created',
  'instrument_model.updated',
  'instrument_model.deleted',
  // Legal — instances (public, documented as phase 2)
  'case.created',
  'case.updated',
  'case.deleted',
  'task.created',
  'task.updated',
  'task.deleted',
  'instrument.created',
  'instrument.updated',
  'instrument.deleted',
] as const;

export const INTERNAL_EVENT_TYPES = [
  'auth.login_failed',
  'session.created',
  'cache.invalidated',
] as const;

export type PublicEventType = (typeof PUBLIC_EVENT_TYPES)[number];
export type InternalEventType = (typeof INTERNAL_EVENT_TYPES)[number];
export type EventType = PublicEventType | InternalEventType;

export type EventVisibility = 'public' | 'internal';

const PUBLIC_SET = new Set<string>(PUBLIC_EVENT_TYPES);
const INTERNAL_SET = new Set<string>(INTERNAL_EVENT_TYPES);

export function isPublicEventType(type: string): type is PublicEventType {
  return PUBLIC_SET.has(type);
}

export function isInternalEventType(type: string): type is InternalEventType {
  return INTERNAL_SET.has(type);
}

export function isKnownEventType(type: string): type is EventType {
  return isPublicEventType(type) || isInternalEventType(type);
}

export function eventVisibility(type: EventType): EventVisibility {
  return isPublicEventType(type) ? 'public' : 'internal';
}
