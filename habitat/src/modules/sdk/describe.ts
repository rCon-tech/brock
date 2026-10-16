import type { FieldSpec } from './types';

const LABEL: Record<string, string> = {
  text: 'short text',
  longtext: 'text',
  integer: 'number',
  number: 'number',
  boolean: 'yes/no',
  date: 'date',
  datetime: 'date and time',
  enum: 'choice',
  url: 'link',
  media: 'photo',
  'media-list': 'photos',
  member: 'person',
  'member-list': 'people',
  'text-list': 'list',
  money: 'amount of money',
};

/** "title (short text), starts at (date and time)…": for the library's "what it stores" panel. */
export function fieldSummary(spec: FieldSpec): string {
  const names = Object.entries(spec).map(
    ([k, f]) => `${k.replace(/([A-Z])/g, ' $1').toLowerCase()} (${LABEL[f.type] ?? f.type})`,
  );
  return names.length ? names.join(', ') : 'just who and when';
}
