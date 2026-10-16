'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { RealtimeEvent } from '@/lib/realtime';
import { useHabitat } from '@/modules/sdk/context';

interface RealtimeValue {
  /** true once a live connection exists; false means "poll instead". */
  live: boolean;
  typing: string[];
  sendTyping: () => void;
}

const Ctx = createContext<RealtimeValue>({ live: false, typing: [], sendTyping: () => {} });
export const useRealtime = () => useContext(Ctx);

type AblyChannel = {
  subscribe: (fn: (m: { name: string; data: unknown; clientId?: string }) => void) => void;
  publish: (name: string, data: unknown) => void;
  unsubscribe: () => void;
};

/**
 * One Ably connection per open Habitat. It only delivers "something changed" signals; the data
 * itself always comes from our API, so permissions are enforced there. Without ABLY_API_KEY the
 * token route answers 204 and the app polls instead.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { habitatId, me } = useHabitat();
  const qc = useQueryClient();
  const [live, setLive] = useState(false);
  const [typing, setTyping] = useState<string[]>([]);
  const channelRef = useRef<AblyChannel | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    let closed = false;
    let cleanup = () => {};
    (async () => {
      const probe = await fetch(`/api/habitats/${habitatId}/realtime-token`).catch(() => null);
      if (!probe || probe.status !== 200 || closed) return;
      const Ably = await import('ably');
      const client = new Ably.Realtime({
        clientId: me.id,
        authCallback: async (_params, cb) => {
          try {
            const r = await fetch(`/api/habitats/${habitatId}/realtime-token`);
            if (r.status !== 200) return cb('Realtime unavailable', null);
            cb(null, await r.json());
          } catch (e) {
            cb(e instanceof Error ? e.message : String(e), null);
          }
        },
      });
      const channel = client.channels.get(`habitat:${habitatId}`) as unknown as AblyChannel;
      channelRef.current = channel;
      const timers = new Map<string, ReturnType<typeof setTimeout>>();
      channel.subscribe((m) => {
        if (m.name === 'typing') {
          const who = m.clientId;
          if (!who || who === me.id) return;
          setTyping((t) => (t.includes(who) ? t : [...t, who]));
          clearTimeout(timers.get(who));
          timers.set(
            who,
            setTimeout(() => setTyping((t) => t.filter((x) => x !== who)), 3500),
          );
          return;
        }
        const e = m.data as RealtimeEvent;
        const base = ['habitat', habitatId];
        switch (e?.type) {
          case 'record.created':
          case 'record.updated':
          case 'record.deleted':
            qc.invalidateQueries({ queryKey: [...base, 'records', e.moduleId] });
            qc.invalidateQueries({ queryKey: [...base, 'timeline'] });
            break;
          case 'proposal.decided':
          case 'modules.changed':
            qc.invalidateQueries({ queryKey: [...base, 'proposals'] });
            qc.invalidateQueries({ queryKey: [...base, 'modules'] });
            window.dispatchEvent(new Event('habitat:modules-changed'));
            break;
          case 'notification':
            qc.invalidateQueries({ queryKey: ['notifications'] });
            break;
        }
      });
      client.connection.on('connected', () => !closed && setLive(true));
      client.connection.on('disconnected', () => !closed && setLive(false));
      cleanup = () => {
        channel.unsubscribe();
        client.close();
        timers.forEach(clearTimeout);
      };
    })();
    return () => {
      closed = true;
      channelRef.current = null;
      setLive(false);
      cleanup();
    };
  }, [habitatId, me.id, qc]);

  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (!channelRef.current || now - lastSent.current < 2000) return;
    lastSent.current = now;
    channelRef.current.publish('typing', {});
  }, []);

  const value = useMemo(() => ({ live, typing, sendTyping }), [live, typing, sendTyping]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
