'use client';

import { useDrag } from '@use-gesture/react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ActionResult } from '@/lib/action';
import { CardDetailSheet } from '@/components/CardDetailSheet';
import { CardImage } from '@/components/CardImage';
import { SwipeHint } from '@/components/SwipeHint';
import { VetoSheet } from '@/components/VetoSheet';
import type { ItemCard } from '@/lib/catalogue/load';
import { enqueue, flush, pendingCount } from '@/lib/client/swipe-queue';
import { formatPrice } from '@/lib/locale';

type Round = 'macro' | 'micro' | 'bridge';

interface Props {
  participantId: string;
  round: Round;
  /** Unanswered cards, in this person's own order. */
  cards: ItemCard[];
  /** Spare cards that stand in for any whose image fails to load (R33). */
  reserves: ItemCard[];
  /** How many cards this round has in total (for the progress bar). */
  total: number;
  vetoesLeft: number;
  /** Called once every card is answered and saved. */
  finish: () => Promise<ActionResult<unknown>>;
  /** Where to go afterwards. `null` shows the interlude, then refreshes. */
  nextHref: string | null;
  interlude?: { title: string; body: string; button: string };
  heading: string;
}

interface Answered {
  card: ItemCard;
  value: 1 | -1;
  veto: boolean;
}

const COMMIT_DISTANCE = 110;

function subscribeOnline(notify: () => void) {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
}

export function SwipeDeck({
  participantId,
  round,
  cards,
  reserves,
  total,
  vetoesLeft: initialVetoes,
  finish,
  nextHref,
  interlude,
  heading,
}: Props) {
  const router = useRouter();
  const [deck, setDeck] = useState<ItemCard[]>(cards);
  const [spare, setSpare] = useState<ItemCard[]>(reserves);
  const [history, setHistory] = useState<Answered[]>([]);
  const [vetoes, setVetoes] = useState(initialVetoes);
  const [detail, setDetail] = useState<ItemCard | null>(null);
  const [vetoCard, setVetoCard] = useState<ItemCard | null>(null);
  const [phase, setPhase] = useState<'swiping' | 'saving' | 'interlude' | 'error'>(
    cards.length ? 'swiping' : 'saving',
  );
  const [pending, setPending] = useState(0);
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [error, setError] = useState<string | null>(null);
  const shownAt = useRef(0);
  const exiting = useRef(false);

  const answered = total - deck.length;
  const top = deck[0];
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-12, 12]);
  const yesOpacity = useTransform(x, [20, 120], [0, 1]);
  const noOpacity = useTransform(x, [-120, -20], [1, 0]);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [top?.id]);

  // Warm the next few images so swiping never waits on the network (R32).
  useEffect(() => {
    for (const c of deck.slice(1, 7)) new Image().src = c.imageUrl;
  }, [deck]);

  const refreshPending = useCallback(
    async () => setPending(await pendingCount(participantId)),
    [participantId],
  );

  const sync = useCallback(async () => {
    const result = await flush(participantId);
    setPending(result.pending);
    return result;
  }, [participantId]);

  useEffect(() => {
    // State is only touched in the promise callback, never synchronously in the effect.
    const send = () => void flush(participantId).then((r) => setPending(r.pending));
    const goOnline = () => send();
    const visible = () => {
      if (!document.hidden) send();
    };
    window.addEventListener('online', goOnline);
    document.addEventListener('visibilitychange', visible);
    send();
    return () => {
      window.removeEventListener('online', goOnline);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [participantId]);

  const runFinish = useCallback(async () => {
    // Everything must be on the server before the round can be marked finished.
    for (let attempt = 0; attempt < 20; attempt++) {
      const result = await sync();
      if (result.ok) break;
      await new Promise((r) => setTimeout(r, Math.min(1000 * (attempt + 1), 5000)));
    }
    if ((await pendingCount(participantId)) > 0) {
      setError('We’re waiting for a connection. Your swipes are saved on this phone.');
      setPhase('error');
      return;
    }
    const result = await finish();
    if (!result.ok) {
      setError(result.error);
      setPhase('error');
      return;
    }
    if (nextHref) router.push(nextHref);
    else setPhase('interlude');
  }, [finish, nextHref, participantId, router, sync]);

  const finishRound = useCallback(() => {
    setPhase('saving');
    setError(null);
    return runFinish();
  }, [runFinish]);

  useEffect(() => {
    // An empty deck on arrival means the round was already answered; just mark it finished.
    if (cards.length === 0) void Promise.resolve().then(runFinish);
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = useCallback(
    async (value: 1 | -1, veto?: { attribute: string | null }) => {
      const card = deck[0];
      if (!card || exiting.current) return;
      exiting.current = true;
      await animate(x, value * 600, { duration: 0.18 });
      const clientId = crypto.randomUUID();
      if (veto) {
        await enqueue(participantId, {
          type: 'veto',
          clientId,
          itemId: card.id,
          attribute: veto.attribute,
        });
        setVetoes((v) => v - 1);
      } else {
        await enqueue(participantId, {
          type: 'swipe',
          clientId,
          itemId: card.id,
          round,
          value,
          decisionMs: Date.now() - shownAt.current,
          position: answered,
        });
      }
      setHistory((h) => [...h, { card, value, veto: !!veto }]);
      const rest = deck.slice(1);
      setDeck(rest);
      x.set(0);
      exiting.current = false;
      void sync().then(refreshPending);
      void refreshPending();
      if (rest.length === 0) void finishRound();
    },
    [answered, deck, finishRound, participantId, refreshPending, round, sync, x],
  );

  const undo = useCallback(async () => {
    const last = history[history.length - 1];
    if (!last || exiting.current || phase !== 'swiping') return;
    await enqueue(participantId, { type: 'undo', itemId: last.card.id });
    if (last.veto) setVetoes((v) => v + 1);
    setHistory((h) => h.slice(0, -1));
    setDeck((d) => [last.card, ...d]);
    void sync().then(refreshPending);
  }, [history, participantId, phase, refreshPending, sync]);

  // A card whose image won't load is swapped for a reserve and reported (R33).
  const imageFailed = useCallback(
    (card: ItemCard) => {
      void fetch('/api/report-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: card.id }),
        keepalive: true,
      }).catch(() => {});
      const [replacement, ...restSpare] = spare;
      if (!replacement) return;
      setSpare(restSpare);
      setDeck((d) => d.map((c) => (c.id === card.id ? replacement : c)));
    },
    [spare],
  );

  const bind = useDrag(
    ({ down, movement: [mx], velocity: [vx], tap }) => {
      if (tap) {
        if (top) setDetail(top);
        return;
      }
      if (down) {
        x.set(mx);
        return;
      }
      if (Math.abs(mx) > COMMIT_DISTANCE || (Math.abs(vx) > 0.5 && Math.abs(mx) > 40)) {
        void commit(mx > 0 ? 1 : -1);
      } else {
        animate(x, 0, { type: 'spring', stiffness: 420, damping: 32 });
      }
    },
    { axis: 'x', filterTaps: true, pointer: { touch: true } },
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (detail || vetoCard || phase !== 'swiping') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') void commit(1);
      else if (e.key === 'ArrowLeft') void commit(-1);
      else if (e.key === 'u' || e.key === 'U') void undo();
      else if ((e.key === 'i' || e.key === 'I') && top) setDetail(top);
      else if ((e.key === 'v' || e.key === 'V') && top && vetoes > 0 && round !== 'bridge')
        setVetoCard(top);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commit, detail, phase, round, top, undo, vetoCard, vetoes]);

  const progress = useMemo(
    () => Math.min(100, Math.round((answered / Math.max(total, 1)) * 100)),
    [answered, total],
  );

  if (phase === 'interlude' && interlude) {
    return (
      <div className="card flex flex-col items-center gap-4 p-8 text-center" role="status">
        <h2 className="text-3xl font-bold">{interlude.title}</h2>
        <p className="text-muted">{interlude.body}</p>
        <button type="button" className="btn btn-primary" onClick={() => router.refresh()}>
          {interlude.button}
        </button>
      </div>
    );
  }

  if (phase === 'saving' || phase === 'error') {
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center" role="status">
        <h2 className="text-2xl font-bold">
          {phase === 'error' ? 'Almost there' : 'Saving your swipes…'}
        </h2>
        {error ? <p className="text-sm text-clay-dark">{error}</p> : null}
        {phase === 'error' ? (
          <button type="button" className="btn btn-primary" onClick={() => void finishRound()}>
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{heading}</h1>
        <span className="text-sm text-muted" aria-live="polite">
          {Math.min(answered + 1, total)} of {total}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-sand"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress"
      >
        <div
          className="h-full rounded-full bg-clay transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="relative mx-auto aspect-[4/5] w-full max-w-sm select-none">
        {!online || pending > 0 ? (
          <span className="absolute top-2 left-2 z-10 chip bg-paper/90 shadow" role="status">
            {online ? 'Saving…' : 'Saved, will sync'}
          </span>
        ) : null}
        {deck.slice(1, 3).map((c, i) => (
          <div
            key={c.id}
            aria-hidden
            className="absolute inset-0 overflow-hidden rounded-3xl border border-sand bg-sand shadow-sm"
            style={{
              transform: `scale(${1 - (i + 1) * 0.04}) translateY(${(i + 1) * 12}px)`,
              zIndex: 2 - i,
            }}
          />
        ))}
        {top ? (
          <motion.div
            key={top.id}
            {...(bind() as object)}
            style={{ x, rotate, zIndex: 5, touchAction: 'pan-y' }}
            className="absolute inset-0 cursor-grab overflow-hidden rounded-3xl border border-sand bg-paper shadow-lg active:cursor-grabbing"
            aria-label={`${top.title}. Swipe right for yes, left for no, or tap for details.`}
          >
            <CardImage
              src={top.imageUrl}
              alt={top.title}
              className="pointer-events-none h-full w-full object-cover"
              eager
              onError={() => imageFailed(top)}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 via-ink/40 to-transparent p-4 pt-16 text-paper">
              <p className="font-display text-xl font-bold">{top.title}</p>
              {top.tier === 'micro' ? (
                <p className="text-sm text-paper/90">
                  {[top.retailer, formatPrice(top.pricePence)].filter(Boolean).join(' · ')}
                </p>
              ) : top.attributionName ? (
                <p className="text-xs text-paper/80">Photo by {top.attributionName}</p>
              ) : null}
            </div>
            <motion.span
              style={{ opacity: yesOpacity }}
              className="pointer-events-none absolute top-5 left-5 -rotate-12 rounded-lg border-4 border-sage px-3 py-1 font-display text-2xl font-bold text-sage"
            >
              YES
            </motion.span>
            <motion.span
              style={{ opacity: noOpacity }}
              className="pointer-events-none absolute top-5 right-5 rotate-12 rounded-lg border-4 border-clay px-3 py-1 font-display text-2xl font-bold text-clay"
            >
              NO
            </motion.span>
          </motion.div>
        ) : null}
        <SwipeHint show={round === 'macro' && answered === 0 && history.length === 0} />
      </div>

      <div className="mx-auto flex w-full max-w-sm items-center justify-between gap-2">
        <button
          type="button"
          className="btn btn-secondary h-14 w-14 rounded-full p-0 text-xl"
          aria-label="No"
          onClick={() => void commit(-1)}
        >
          ✕
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void undo()}
          disabled={history.length === 0}
          aria-label="Undo last swipe"
        >
          Undo
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => top && setDetail(top)}
          aria-label="Show details"
        >
          Details
        </button>
        {round !== 'bridge' ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => top && setVetoCard(top)}
            disabled={vetoes === 0}
            aria-label={`Veto this card, ${vetoes} left`}
          >
            Veto ({vetoes})
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-primary h-14 w-14 rounded-full p-0 text-xl"
          aria-label="Yes"
          onClick={() => void commit(1)}
        >
          ♥
        </button>
      </div>
      <p className="text-center text-xs text-muted">
        Keyboard: ← no, → yes, U undo, I details{round !== 'bridge' ? ', V veto' : ''}
      </p>

      <CardDetailSheet
        card={detail}
        onClose={() => setDetail(null)}
        onAnswer={(v) => void commit(v)}
        onVeto={() => detail && setVetoCard(detail)}
        canVeto={vetoes > 0 && round !== 'bridge'}
      />
      <VetoSheet
        card={vetoCard}
        vetoesLeft={vetoes}
        onClose={() => setVetoCard(null)}
        onConfirm={(attribute) => {
          setVetoCard(null);
          void commit(-1, { attribute });
        }}
      />
    </div>
  );
}
