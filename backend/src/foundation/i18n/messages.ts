import type { Locale } from './locale.js';

export type MessageKey =
  | 'error.unauthorized'
  | 'error.bad_request'
  | 'error.conflict'
  | 'error.internal'
  | 'error.invalid_credentials'
  | 'error.tenant_slug_taken'
  | 'error.tenant_slug_invalid'
  | 'error.login_ambiguous'
  | 'error.session_expired'
  | 'error.validation_failed'
  | 'error.not_found'
  | 'error.key_conflict'
  | 'error.model_in_use'
  | 'error.attribute_not_defined'
  | 'error.attribute_definition_reserved'
  | 'error.invalid_attribute_value'
  | 'error.select_option_in_use'
  | 'error.forbidden'
  | 'error.username_taken'
  | 'error.last_admin'
  | 'error.cannot_demote_self'
  | 'error.task_model_not_allowed_on_case_model';

const messages: Record<MessageKey, Record<Locale, string>> = {
  'error.unauthorized': {
    de: 'Authentifizierung erforderlich.',
    en: 'Authentication required.',
  },
  'error.bad_request': {
    de: 'Ungültige Anfrage.',
    en: 'Invalid request.',
  },
  'error.conflict': {
    de: 'Konflikt mit vorhandenen Daten.',
    en: 'Conflict with existing data.',
  },
  'error.internal': {
    de: 'Interner Serverfehler.',
    en: 'Internal server error.',
  },
  'error.invalid_credentials': {
    de: 'Anmeldung fehlgeschlagen.',
    en: 'Login failed.',
  },
  'error.tenant_slug_taken': {
    de: 'Diese Kanzlei-Kennung ist bereits vergeben.',
    en: 'This firm identifier is already taken.',
  },
  'error.tenant_slug_invalid': {
    de: 'Ungültige Kanzlei-Kennung.',
    en: 'Invalid firm identifier.',
  },
  'error.login_ambiguous': {
    de: 'Benutzername ist nicht eindeutig. Bitte den Administrator kontaktieren.',
    en: 'Username is not unique. Please contact your administrator.',
  },
  'error.session_expired': {
    de: 'Sitzung abgelaufen.',
    en: 'Session expired.',
  },
  'error.validation_failed': {
    de: 'Validierung fehlgeschlagen.',
    en: 'Validation failed.',
  },
  'error.not_found': {
    de: 'Ressource nicht gefunden.',
    en: 'Resource not found.',
  },
  'error.key_conflict': {
    de: 'Schlüssel ist bereits vergeben.',
    en: 'Key already exists.',
  },
  'error.model_in_use': {
    de: 'Modell wird noch verwendet und kann nicht gelöscht werden.',
    en: 'Model is in use and cannot be deleted.',
  },
  'error.attribute_not_defined': {
    de: 'Attribut ist am Modell nicht definiert.',
    en: 'Attribute is not defined on the model.',
  },
  'error.attribute_definition_reserved': {
    de: 'Dieses Plattform-Attribut kann nicht geändert oder gelöscht werden.',
    en: 'This platform attribute cannot be modified or deleted.',
  },
  'error.invalid_attribute_value': {
    de: 'Ungültiger Attributwert.',
    en: 'Invalid attribute value.',
  },
  'error.select_option_in_use': {
    de: 'Auswahlwert wird noch von Instanzen verwendet und kann nicht entfernt werden.',
    en: 'Select option is still used by instances and cannot be removed.',
  },
  'error.forbidden': {
    de: 'Keine Berechtigung für diese Aktion.',
    en: 'You do not have permission for this action.',
  },
  'error.username_taken': {
    de: 'Dieser Benutzername ist in der Kanzlei bereits vergeben.',
    en: 'This username is already taken in your firm.',
  },
  'error.last_admin': {
    de: 'Es muss mindestens ein aktiver Administrator verbleiben.',
    en: 'At least one active administrator must remain.',
  },
  'error.cannot_demote_self': {
    de: 'Sie können Ihre eigene Administrator-Rolle nicht entziehen.',
    en: 'You cannot remove your own administrator role.',
  },
  'error.task_model_not_allowed_on_case_model': {
    de: 'Dieses Task-Modell ist für das Case-Modell nicht erlaubt.',
    en: 'This task model is not allowed on the case model.',
  },
};

export function t(locale: Locale, key: MessageKey): string {
  return messages[key][locale] ?? messages[key].de;
}
