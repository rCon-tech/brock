import { describe, expect, it } from 'vitest';
import { decide, describeRule, type DecideInput } from '@/lib/governance';

const t0 = new Date('2026-01-01T00:00:00Z');
const open = new Date('2026-01-02T00:00:00Z'); // closes after `t0`
const closed = new Date('2026-01-03T00:00:00Z'); // now after close

const base = (o: Partial<DecideInput>): DecideInput => ({
  mode: 'majority',
  yes: 0,
  no: 0,
  memberCount: 6,
  closesAt: open,
  now: t0,
  ...o,
});

describe('majority', () => {
  it('2 members: one yes stays open, two pass', () => {
    expect(decide(base({ memberCount: 2, yes: 1 }))).toBe('open');
    expect(decide(base({ memberCount: 2, yes: 2 }))).toBe('passed');
  });
  it('2 members: one no rejects (both must agree)', () => {
    expect(decide(base({ memberCount: 2, yes: 1, no: 1 }))).toBe('rejected');
    expect(decide(base({ memberCount: 2, no: 1 }))).toBe('rejected');
  });
  it('6 members: 4 yes pass early, 3 no reject early', () => {
    expect(decide(base({ yes: 3 }))).toBe('open');
    expect(decide(base({ yes: 4 }))).toBe('passed');
    expect(decide(base({ no: 2 }))).toBe('open');
    expect(decide(base({ no: 3 }))).toBe('rejected');
  });
  it('150 members: 76 yes pass, 75 no reject', () => {
    expect(decide(base({ memberCount: 150, yes: 75 }))).toBe('open');
    expect(decide(base({ memberCount: 150, yes: 76 }))).toBe('passed');
    expect(decide(base({ memberCount: 150, no: 75 }))).toBe('rejected');
  });
  it('at close: 2 yes / 1 no of 9 passes (turnout 1/3)', () => {
    expect(decide(base({ memberCount: 9, yes: 2, no: 1, now: closed }))).toBe('passed');
  });
  it('at close: 2 yes / 0 no of 9 fails (turnout under 1/3)', () => {
    expect(decide(base({ memberCount: 9, yes: 2, now: closed }))).toBe('rejected');
  });
  it('at close: a tie fails', () => {
    expect(decide(base({ memberCount: 9, yes: 2, no: 2, now: closed }))).toBe('rejected');
  });
  it('stays open before the window closes', () => {
    expect(decide(base({ memberCount: 9, yes: 2, no: 1 }))).toBe('open');
  });
  it('a member leaving mid-vote changes the threshold', () => {
    expect(decide(base({ memberCount: 6, yes: 3 }))).toBe('open');
    expect(decide(base({ memberCount: 5, yes: 3 }))).toBe('passed');
  });
});

describe('unanimous', () => {
  it('fails on any single no', () => {
    expect(decide(base({ mode: 'unanimous', yes: 5, no: 1 }))).toBe('rejected');
  });
  it('passes only when everyone says yes', () => {
    expect(decide(base({ mode: 'unanimous', yes: 5 }))).toBe('open');
    expect(decide(base({ mode: 'unanimous', yes: 6 }))).toBe('passed');
  });
  it('fails at close if someone has not voted', () => {
    expect(decide(base({ mode: 'unanimous', yes: 5, now: closed }))).toBe('rejected');
  });
});

describe('admins', () => {
  it('an admin vote decides immediately', () => {
    expect(decide(base({ mode: 'admins', adminVote: 'yes' }))).toBe('passed');
    expect(decide(base({ mode: 'admins', adminVote: 'no' }))).toBe('rejected');
  });
  it('member votes change nothing', () => {
    expect(decide(base({ mode: 'admins', yes: 5, adminVote: null }))).toBe('open');
  });
  it('lapses at close with no admin vote', () => {
    expect(decide(base({ mode: 'admins', yes: 5, now: closed }))).toBe('rejected');
  });
});

describe('describeRule', () => {
  it('spells out the threshold', () => {
    expect(describeRule('majority', 6)).toBe('Passes when 4 of 6 say yes.');
    expect(describeRule('majority', 2)).toBe('Passes when 2 of 2 say yes.');
    expect(describeRule('unanimous', 3)).toContain('all 3');
    expect(describeRule('admins', 3)).toContain('admin');
  });
});
