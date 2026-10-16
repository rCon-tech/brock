'use client';

import { Check, Copy, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldError, Input, Label } from '@/components/ui/input';
import { ApiError, apiFetch, errorMessage } from '@/lib/api-client';
import { cn, inkFor } from '@/lib/utils';

export interface StarterModule {
  id: string;
  name: string;
  tagline: string;
  icon: string;
}
export interface LibraryTeaser {
  name: string;
  tagline: string;
}

const EMOJI = ['🌿', '🍻', '🏡', '⚽', '🎲', '🎸', '🏕️', '✈️', '🍕', '🐶', '📚', '🎮', '🌮', '🏖️', '🧗', '🎉'];
const COLOURS = ['#e8590c', '#d6336c', '#7048e8', '#1c7ed6', '#0c8599', '#2b8a3e', '#f08c00', '#495057'];

export function CreateHabitatWizard({ starters, later }: { starters: StarterModule[]; later: LibraryTeaser[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJI[0]!);
  const [accent, setAccent] = useState(COLOURS[0]!);
  const [picked, setPicked] = useState<Set<string>>(new Set(starters.map((s) => s.id)));
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [created, setCreated] = useState<{ slug: string; inviteUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function create() {
    setBusy(true);
    setFields({});
    try {
      const { habitat } = await apiFetch<{ habitat: { id: string; slug: string } }>('/api/habitats', {
        method: 'POST',
        body: { name, emoji, accent, modules: [...picked] },
      });
      const invite = await apiFetch<{ url: string }>(`/api/habitats/${habitat.id}/invites`, { method: 'POST', body: {} });
      setCreated({ slug: habitat.slug, inviteUrl: invite.url });
      setStep(3);
    } catch (e) {
      if (e instanceof ApiError && e.fields?.name) {
        setFields(e.fields);
        setStep(0);
      } else toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(created!.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    try {
      await navigator.share({ title: `Join ${name} on Habitat`, url: created!.inviteUrl });
    } catch {
      /* dismissed */
    }
  }

  const preview = (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ background: accent, color: inkFor(accent) }} aria-hidden>
        {emoji}
      </span>
      <div>
        <div className="font-bold">{name.trim() || 'Your Habitat'}</div>
        <div className="text-xs text-ink-soft">{picked.size} modules · just you for now</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <ol className="flex gap-2" aria-label="Progress">
        {['Name', 'Look', 'Modules', 'Invite'].map((label, i) => (
          <li key={label} className={cn('h-1.5 flex-1 rounded-full', i <= step ? 'bg-accent' : 'bg-line')} aria-current={i === step ? 'step' : undefined}>
            <span className="sr-only">{label}</span>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="space-y-4">
          <h1 className="text-2xl font-extrabold">What’s your Habitat called?</h1>
          <div>
            <Label htmlFor="hname">Name</Label>
            <Input id="hname" autoFocus maxLength={60} placeholder="The Lads, Flat 4, Book Club…" value={name} onChange={(e) => setName(e.target.value)} />
            <FieldError messages={fields.name} />
          </div>
          <Button size="lg" className="w-full" disabled={name.trim().length < 2} onClick={() => setStep(1)}>
            Next
          </Button>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-4">
          <h1 className="text-2xl font-extrabold">Make it yours</h1>
          {preview}
          <div>
            <Label>Emoji</Label>
            <div className="grid grid-cols-8 gap-1">
              {EMOJI.map((e) => (
                <button key={e} type="button" onClick={() => setEmoji(e)} aria-label={`Use ${e}`} aria-pressed={emoji === e} className={cn('rounded-xl p-2 text-2xl hover:bg-surface-2', emoji === e && 'bg-surface-2 ring-2 ring-accent')}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Colour</Label>
            <div className="flex flex-wrap gap-2">
              {COLOURS.map((c) => (
                <button key={c} type="button" onClick={() => setAccent(c)} aria-label={`Colour ${c}`} aria-pressed={accent === c} className={cn('flex h-10 w-10 items-center justify-center rounded-full', accent === c && 'ring-2 ring-ink ring-offset-2 ring-offset-background')} style={{ background: c, color: inkFor(c) }}>
                  {accent === c && <Check size={18} />}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="lg" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button size="lg" className="flex-1" onClick={() => setStep(2)}>
              Next
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <h1 className="text-2xl font-extrabold">What do you want to start with?</h1>
          <p className="text-sm text-ink-soft">Untick anything you don’t need. You can add or remove pieces any time, by group vote.</p>
          <ul className="space-y-2">
            {starters.map((m) => (
              <li key={m.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-3 has-[:checked]:border-accent">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 accent-[var(--accent)]"
                    checked={picked.has(m.id)}
                    onChange={(e) => {
                      const next = new Set(picked);
                      if (e.target.checked) next.add(m.id);
                      else next.delete(m.id);
                      setPicked(next);
                    }}
                  />
                  <span>
                    <span className="block font-semibold">{m.name}</span>
                    <span className="block text-sm text-ink-soft">{m.tagline}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <Card className="bg-surface-2 text-sm">
            <p className="font-semibold">Add later by vote</p>
            <p className="mt-1 text-ink-soft">{later.map((l) => l.name).join(' · ')}</p>
          </Card>
          <div className="flex gap-2">
            <Button variant="outline" size="lg" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button size="lg" className="flex-1" disabled={busy} onClick={create}>
              {busy ? 'Creating…' : 'Create Habitat'}
            </Button>
          </div>
        </section>
      )}

      {step === 3 && created && (
        <section className="space-y-4">
          <h1 className="text-2xl font-extrabold">Invite your friends</h1>
          {preview}
          <p className="text-sm text-ink-soft">Anyone with this link can join. It works for 7 days. Only share it with people you trust.</p>
          <div className="flex gap-2">
            <Input readOnly value={created.inviteUrl} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
            <Button variant="secondary" onClick={copy} aria-label="Copy link">
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </Button>
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <Button variant="secondary" onClick={share} aria-label="Share link">
                <Share2 size={18} />
              </Button>
            )}
          </div>
          <Button size="lg" className="w-full" onClick={() => router.push(`/h/${created.slug}`)}>
            Go to {name}
          </Button>
        </section>
      )}
    </div>
  );
}
