export type GovernanceMode = 'majority' | 'unanimous' | 'admins';
export type Decision = 'open' | 'passed' | 'rejected';

export interface DecideInput {
  mode: GovernanceMode;
  yes: number;
  no: number;
  /** Current members, counted at decision time. */
  memberCount: number;
  closesAt: Date;
  now: Date;
  /** In `admins` mode: how the first admin to vote voted, if any admin has. */
  adminVote?: 'yes' | 'no' | null;
}

/** Fraction of members that must vote for a vote to count when the window closes (H7). */
export const MIN_TURNOUT = 1 / 3;

/** H7 and H8. `yes` and `no` must already exclude votes from people who have left. */
export function decide(i: DecideInput): Decision {
  const { mode, yes, no, memberCount, now } = i;
  const closed = now.getTime() >= i.closesAt.getTime();

  if (mode === 'admins') {
    if (i.adminVote === 'yes') return 'passed';
    if (i.adminVote === 'no') return 'rejected';
    return closed ? 'rejected' : 'open';
  }

  if (mode === 'unanimous') {
    if (no > 0) return 'rejected';
    if (yes >= memberCount) return 'passed';
    return closed ? 'rejected' : 'open';
  }

  // majority
  if (yes * 2 > memberCount) return 'passed';
  if (no * 2 >= memberCount) return 'rejected';
  if (closed) {
    const turnoutOk = (yes + no) * 3 >= memberCount;
    return yes > no && turnoutOk ? 'passed' : 'rejected';
  }
  return 'open';
}

/** The rule in plain English, shown on the vote card. */
export function describeRule(mode: GovernanceMode, memberCount: number): string {
  if (mode === 'admins') return 'Any admin can decide this by voting.';
  if (mode === 'unanimous')
    return `Passes when all ${memberCount} members say yes. Any no stops it.`;
  const need = Math.floor(memberCount / 2) + 1;
  return `Passes when ${need} of ${memberCount} say yes.`;
}
