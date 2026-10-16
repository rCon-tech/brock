'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/card';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RelativeTime } from '@/components/RelativeTime';
import { ApiError, apiFetch, errorMessage } from '@/lib/api-client';
import { cn, inkFor } from '@/lib/utils';
import { useHabitat } from '@/modules/sdk/context';

const COLOURS = [
  '#e8590c',
  '#d6336c',
  '#7048e8',
  '#1c7ed6',
  '#0c8599',
  '#2b8a3e',
  '#f08c00',
  '#495057',
];
const EMOJI = [
  '🌿',
  '🍻',
  '🏡',
  '⚽',
  '🎲',
  '🎸',
  '🏕️',
  '✈️',
  '🍕',
  '🐶',
  '📚',
  '🎮',
  '🌮',
  '🏖️',
  '🧗',
  '🎉',
];

export interface SettingsData {
  name: string;
  emoji: string;
  accent: string;
  description: string;
  membersCanInvite: boolean;
  voteWindowHours: number;
  governance: 'majority' | 'unanimous' | 'admins';
  modules: Array<{ id: string; name: string }>;
}

const RULES: Record<SettingsData['governance'], { title: string; text: string }> = {
  majority: {
    title: 'Majority',
    text: 'Passes when more than half say yes, or when time runs out with more yes than no and at least a third voting.',
  },
  unanimous: { title: 'Everyone agrees', text: 'Every member must say yes. A single no stops it.' },
  admins: {
    title: 'Admins decide',
    text: 'Any admin’s vote decides immediately. Members can suggest, admins choose.',
  },
};

export function HabitatSettings({ initial, isOwner }: { initial: SettingsData; isOwner: boolean }) {
  const { habitatId, slug } = useHabitat();
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState(initial);
  const [order, setOrder] = useState(initial.modules);
  const [mode, setMode] = useState(initial.governance);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/api/habitats/${habitatId}`, {
        method: 'PATCH',
        body: {
          name: form.name,
          emoji: form.emoji,
          accent: form.accent,
          description: form.description.trim() || null,
          membersCanInvite: form.membersCanInvite,
          voteWindowHours: form.voteWindowHours,
        },
      }),
    onSuccess: () => {
      toast.success('Saved');
      qc.invalidateQueries({ queryKey: ['my-habitats'] });
      router.refresh();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.fields) setErrors(e.fields);
      toast.error(errorMessage(e));
    },
  });

  const reorder = useMutation({
    mutationFn: (next: typeof order) =>
      apiFetch(`/api/habitats/${habitatId}/modules`, {
        method: 'PATCH',
        body: { order: next.map((m) => m.id) },
      }),
    onSuccess: () => router.refresh(),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const proposeMode = useMutation({
    mutationFn: () =>
      apiFetch(`/api/habitats/${habitatId}/proposals`, {
        method: 'POST',
        body: { kind: 'governance', payload: { mode } },
      }),
    onSuccess: () => {
      toast.success('Vote started');
      router.push(`/h/${slug}/proposals`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const move = (i: number, d: -1 | 1) => {
    const next = [...order];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    setOrder(next);
    reorder.mutate(next);
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <h2 className="font-bold">Look and feel</h2>
        <div>
          <Label htmlFor="hn">Name</Label>
          <Input
            id="hn"
            value={form.name}
            maxLength={60}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          {errors.name && <p className="mt-1 text-sm text-danger">{errors.name.join(' ')}</p>}
        </div>
        <div>
          <Label htmlFor="hd">About</Label>
          <Textarea
            id="hd"
            value={form.description}
            maxLength={300}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div>
          <Label>Emoji</Label>
          <div className="grid grid-cols-8 gap-1">
            {EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={form.emoji === e}
                aria-label={`Use ${e}`}
                onClick={() => setForm({ ...form, emoji: e })}
                className={cn(
                  'rounded-xl p-2 text-2xl hover:bg-surface-2',
                  form.emoji === e && 'bg-surface-2 ring-2 ring-accent',
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Colour</Label>
          <div className="flex flex-wrap gap-2">
            {COLOURS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={form.accent === c}
                aria-label={`Colour ${c}`}
                onClick={() => setForm({ ...form, accent: c })}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full',
                  form.accent === c && 'ring-2 ring-ink ring-offset-2 ring-offset-background',
                )}
                style={{ background: c, color: inkFor(c) }}
              >
                {form.accent === c && <Check size={18} />}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">Members can invite</div>
            <div className="text-sm text-ink-soft">
              Otherwise only admins can create invite links.
            </div>
          </div>
          <Switch
            checked={form.membersCanInvite}
            onCheckedChange={(v) => setForm({ ...form, membersCanInvite: v })}
            aria-label="Members can invite"
          />
        </div>
        <div>
          <Label htmlFor="win">How long votes stay open</Label>
          <Select
            id="win"
            value={form.voteWindowHours}
            onChange={(e) => setForm({ ...form, voteWindowHours: Number(e.target.value) })}
          >
            {[12, 24, 48, 72, 168].map((h) => (
              <option key={h} value={h}>
                {h < 48 ? `${h} hours` : `${h / 24} days`}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          Save changes
        </Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">How votes are decided</h2>
        <div className="space-y-2">
          {(Object.keys(RULES) as Array<keyof typeof RULES>).map((k) => (
            <label
              key={k}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border p-3',
                mode === k ? 'border-accent bg-accent/10' : 'border-line',
              )}
            >
              <input
                type="radio"
                name="gov"
                className="mt-1 accent-[var(--accent)]"
                checked={mode === k}
                onChange={() => setMode(k)}
              />
              <span>
                <span className="block font-semibold">
                  {RULES[k].title}{' '}
                  {initial.governance === k && <Badge className="ml-1">current</Badge>}
                </span>
                <span className="block text-sm text-ink-soft">{RULES[k].text}</span>
              </span>
            </label>
          ))}
        </div>
        {mode !== initial.governance && (
          <Button onClick={() => proposeMode.mutate()} disabled={proposeMode.isPending}>
            Propose this change
          </Button>
        )}
        <p className="text-xs text-ink-soft">
          Changing the rule is itself a vote, decided under the current rule.
        </p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">Order of the menu</h2>
        <ul className="divide-y divide-line">
          {order.map((m, i) => (
            <li key={m.id} className="flex items-center justify-between py-2">
              <span>{m.name}</span>
              <span className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Move ${m.name} up`}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Move ${m.name} down`}
                  disabled={i === order.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={16} />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <ReportsPanel />
      {isOwner && <DangerZone />}
    </div>
  );
}

function ReportsPanel() {
  const { habitatId } = useHabitat();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['habitat', habitatId, 'reports'],
    queryFn: () =>
      apiFetch<{
        reports: Array<{
          id: string;
          targetType: string;
          targetId: string;
          reason: string;
          status: string;
          createdAt: string;
          reporter: string | null;
        }>;
      }>(`/api/habitats/${habitatId}/reports`),
  });
  const resolve = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/habitats/${habitatId}/reports/${id}`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['habitat', habitatId, 'reports'] }),
  });
  const open = (data?.reports ?? []).filter((r) => r.status === 'open');
  return (
    <Card className="space-y-3">
      <h2 className="font-bold">
        Reports {open.length > 0 && <Badge tone="danger">{open.length}</Badge>}
      </h2>
      {open.length === 0 ? (
        <p className="text-sm text-ink-soft">Nothing reported. 🎉</p>
      ) : (
        <ul className="space-y-2">
          {open.map((r) => (
            <li key={r.id} className="rounded-xl bg-surface-2 p-3 text-sm">
              <p className="font-semibold">
                {r.reporter ?? 'Someone'} reported a {r.targetType}{' '}
                <RelativeTime iso={r.createdAt} className="font-normal text-ink-soft" />
              </p>
              <p className="mt-1">“{r.reason}”</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => resolve.mutate(r.id)}
              >
                Mark handled
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DangerZone() {
  const { habitatId, name, members } = useHabitat();
  const router = useRouter();
  const [confirmText, setConfirmText] = useState('');
  async function remove() {
    try {
      await apiFetch(`/api/habitats/${habitatId}`, { method: 'DELETE' });
      router.push('/');
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <Card className="space-y-3 border-danger/40">
      <h2 className="font-bold text-danger">Delete this Habitat</h2>
      <p className="text-sm text-ink-soft">
        It disappears for all {members.length} members straight away, and everything in it is erased
        after 30 days.
      </p>
      <Label htmlFor="cf">Type “{name}” to confirm</Label>
      <Input id="cf" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
      <Button variant="danger" disabled={confirmText !== name} onClick={remove}>
        Delete Habitat
      </Button>
    </Card>
  );
}
