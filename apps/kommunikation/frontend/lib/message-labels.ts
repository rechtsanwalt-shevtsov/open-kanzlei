import type { components } from '@shell/api/schema.js';

export type MessageDirection = components['schemas']['MessageDirection'];
export type MessageListItem = components['schemas']['MessageListItem'];
export type Message = components['schemas']['Message'];
export type MessageModel = components['schemas']['MessageModel'];

const DIRECTION_LABELS_DE: Record<MessageDirection, string> = {
  incoming: 'Eingehend',
  outgoing: 'Ausgehend',
  internal: 'Intern',
  draft: 'Entwurf',
};

const DIRECTION_LABELS_EN: Record<MessageDirection, string> = {
  incoming: 'Incoming',
  outgoing: 'Outgoing',
  internal: 'Internal',
  draft: 'Draft',
};

export function directionLabel(direction: MessageDirection, locale: string): string {
  const map = locale === 'en' ? DIRECTION_LABELS_EN : DIRECTION_LABELS_DE;
  return map[direction] ?? direction;
}

export function formatMessageDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale === 'en' ? 'en-GB' : 'de-DE');
}
