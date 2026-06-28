export const MESSAGE_DIRECTIONS = ['incoming', 'outgoing', 'internal', 'draft'] as const;

export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

export function isMessageDirection(value: string): value is MessageDirection {
  return (MESSAGE_DIRECTIONS as readonly string[]).includes(value);
}
