export interface Mentionable {
  userId: string;
  /** Names this member answers to: their nickname and their account name. */
  names: string[];
}

const WORD = /[\p{L}\p{N}_]/u;

/** `@Name` matches a member's nickname or name, case-insensitively; the longest match wins. */
export function extractMentions(text: string, members: Mentionable[]): string[] {
  const candidates = members
    .flatMap((m) => m.names.filter((n) => n.trim()).map((n) => ({ userId: m.userId, name: n.trim().toLowerCase() })))
    .sort((a, b) => b.name.length - a.name.length);
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (let i = 0; i < lower.length; i++) {
    if (lower[i] !== '@') continue;
    if (i > 0 && WORD.test(lower[i - 1]!)) continue; // part of an email address, not a mention
    for (const c of candidates) {
      if (!lower.startsWith(c.name, i + 1)) continue;
      const after = lower[i + 1 + c.name.length];
      if (after !== undefined && WORD.test(after)) continue;
      found.add(c.userId);
      i += c.name.length;
      break;
    }
  }
  return [...found];
}
