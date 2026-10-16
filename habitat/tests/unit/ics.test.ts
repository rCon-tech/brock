import { describe, expect, it } from 'vitest';
import { escapeText, fold, toIcs } from '@/modules/events/ics';

const now = new Date('2026-06-01T10:00:00Z');
const ev = { id: 'abc', title: 'Pub quiz', startsAt: '2026-06-10T19:00:00.000Z' };

describe('ics', () => {
  it('produces a valid, CRLF-terminated calendar with UTC times', () => {
    const ics = toIcs(ev, 'The Lads', now);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20260610T190000Z');
    expect(ics).toContain('DTEND:20260610T200000Z'); // defaults to one hour
    expect(ics).toContain('UID:abc@habitat');
    expect(ics).toContain('DTSTAMP:20260601T100000Z');
    expect(ics.replace(/\r\n/g, '').includes('\n')).toBe(false);
  });
  it('uses the end time, location and details when given', () => {
    const ics = toIcs({ ...ev, endsAt: '2026-06-10T22:30:00Z', location: 'The Red Lion, High St', details: 'Bring cash' }, 'The Lads', now);
    expect(ics).toContain('DTEND:20260610T223000Z');
    expect(ics).toContain('LOCATION:The Red Lion\\, High St');
    expect(ics).toContain('DESCRIPTION:Bring cash\\n\\nFrom The Lads on Habitat');
  });
  it('escapes backslashes, semicolons, commas and newlines', () => {
    expect(escapeText('a;b,c\\d\ne')).toBe('a\;b\\,c\\\\d\\ne');
  });
  it('folds long lines at 75 octets without splitting characters', () => {
    const long = 'SUMMARY:' + 'é'.repeat(60);
    const folded = fold(long);
    for (const [i, line] of folded.split('\r\n').entries()) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
      if (i > 0) expect(line.startsWith(' ')).toBe(true);
    }
    expect(folded.replace(/\r\n /g, '')).toBe(long);
  });
  it('leaves short lines alone', () => {
    expect(fold('SUMMARY:Hi')).toBe('SUMMARY:Hi');
  });
});
