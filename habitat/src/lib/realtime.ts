/**
 * Realtime is optional. With ABLY_API_KEY set, events are published to `habitat:<id>`;
 * without it, publishing is a no-op and clients fall back to polling (see sdk/hooks.ts).
 */
export type RealtimeEvent =
  | { type: 'record.created' | 'record.updated' | 'record.deleted'; moduleId: string; collection: string; id: string }
  | { type: 'proposal.decided'; proposalId: string; status: string }
  | { type: 'modules.changed' }
  | { type: 'notification'; userId: string };

export const realtimeEnabled = () => !!process.env.ABLY_API_KEY;

export function channelName(habitatId: string) {
  return `habitat:${habitatId}`;
}

/** Fire-and-forget after a commit. A failure here must never fail the request. */
export async function publish(habitatId: string, event: RealtimeEvent): Promise<void> {
  const key = process.env.ABLY_API_KEY;
  if (!key) return;
  try {
    const name = encodeURIComponent(channelName(habitatId));
    await fetch(`https://rest.ably.io/channels/${name}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(key).toString('base64')}`,
      },
      body: JSON.stringify({ name: event.type, data: event }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Realtime is best effort; clients also refetch on focus.
  }
}

/** Token request for a browser: subscribe + presence on this Habitat's channel only. */
export async function createTokenRequest(habitatId: string, clientId: string) {
  const key = process.env.ABLY_API_KEY;
  if (!key) return null;
  const { createHmac, randomBytes } = await import('node:crypto');
  const [keyName, secret] = key.split(':');
  const capability = JSON.stringify({ [channelName(habitatId)]: ['subscribe', 'presence', 'publish'] });
  const req = {
    keyName,
    ttl: 3600_000,
    capability,
    clientId,
    timestamp: Date.now(),
    nonce: randomBytes(16).toString('hex'),
  };
  const signText =
    [req.keyName, req.ttl, req.capability, req.clientId, req.timestamp, req.nonce].join('\n') + '\n';
  const mac = createHmac('sha256', secret!).update(signText).digest('base64');
  return { ...req, mac };
}
