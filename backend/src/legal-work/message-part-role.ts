export const MESSAGE_PART_ROLES = [
  'body',
  'attachment',
  'inline',
  'signature',
  'metadata',
  'annotation',
  'summary',
  'ocr',
] as const;

export type MessagePartRole = (typeof MESSAGE_PART_ROLES)[number];

export function isMessagePartRole(value: string): value is MessagePartRole {
  return (MESSAGE_PART_ROLES as readonly string[]).includes(value);
}
