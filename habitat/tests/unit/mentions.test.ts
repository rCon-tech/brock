import { describe, expect, it } from 'vitest';
import { extractMentions } from '@/lib/mentions';

const members = [
  { userId: 'sam', names: ['Sam', 'Sammy'] },
  { userId: 'sam2', names: ['Sam Jones'] },
  { userId: 'jo', names: ['Jo'] },
];

describe('extractMentions', () => {
  it('finds a mention, case-insensitively', () => {
    expect(extractMentions('hey @jo!', members)).toEqual(['jo']);
  });
  it('longest match wins', () => {
    expect(extractMentions('thanks @Sam Jones', members)).toEqual(['sam2']);
    expect(extractMentions('thanks @Sam', members)).toEqual(['sam']);
  });
  it('matches nicknames and de-duplicates', () => {
    expect(extractMentions('@Sammy @sam @Sammy', members)).toEqual(['sam']);
  });
  it('does not match inside a longer word or an email', () => {
    expect(extractMentions('@Joanna', members)).toEqual([]);
    expect(extractMentions('mail jo@example.com', members)).toEqual([]);
  });
  it('ignores unknown names and empty names', () => {
    expect(extractMentions('@nobody', [...members, { userId: 'x', names: ['', '  '] }])).toEqual(
      [],
    );
  });
});
