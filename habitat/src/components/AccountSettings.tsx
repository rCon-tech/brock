'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { authClient } from '@/lib/auth-client';

type Prefs = { digest: boolean; events: boolean; proposals: boolean };

export function AccountSettings({
  name: initialName,
  email,
  prefs: initialPrefs,
}: {
  name: string;
  email: string;
  prefs: Prefs;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [deleteContent, setDeleteContent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function saveName() {
    try {
      await apiFetch('/api/me', { method: 'PATCH', body: { name } });
      toast.success('Saved');
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function savePref(key: keyof Prefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      await apiFetch('/api/me', { method: 'PATCH', body: { emailPrefs: next } });
    } catch (e) {
      setPrefs(prefs);
      toast.error(errorMessage(e));
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await apiFetch(`/api/me?deleteContent=${deleteContent ? 1 : 0}`, { method: 'DELETE' });
      await authClient.signOut();
      router.push('/');
      router.refresh();
    } catch (e) {
      setBusy(false);
      toast.error(errorMessage(e));
    }
  }

  const rows: Array<[keyof Prefs, string, string]> = [
    ['proposals', 'Votes', 'When someone proposes a change, and how it turns out'],
    ['events', 'Event reminders', 'The day before a plan you haven’t declined'],
    ['digest', 'Weekly digest', 'A Monday summary of what you missed'],
  ];

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <h2 className="font-bold">Profile</h2>
        <div>
          <Label htmlFor="n">Name</Label>
          <div className="flex gap-2">
            <Input id="n" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            <Button onClick={saveName} disabled={!name.trim() || name === initialName}>
              Save
            </Button>
          </div>
        </div>
        <p className="text-sm text-ink-soft">Signed in as {email}</p>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-bold">Email</h2>
        {rows.map(([key, title, desc]) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium">{title}</div>
              <div className="text-sm text-ink-soft">{desc}</div>
            </div>
            <Switch
              checked={prefs[key]}
              onCheckedChange={(v) => savePref(key, v)}
              aria-label={title}
            />
          </div>
        ))}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">Your data</h2>
        <p className="text-sm text-ink-soft">
          Download everything you’ve posted, as a file you can keep.
        </p>
        <Button asChild variant="outline">
          <a href="/api/me/export" download>
            Download my data
          </a>
        </Button>
      </Card>

      <Card className="space-y-3 border-danger/40">
        <h2 className="font-bold text-danger">Delete account</h2>
        <p className="text-sm text-ink-soft">
          This removes your account and takes you out of every Habitat. If you own a Habitat with
          other people in it, hand it over first.
        </p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="danger">Delete my account</Button>
          </DialogTrigger>
          <DialogContent title="Delete your account?" description="This can’t be undone.">
            <label className="flex items-start gap-3 rounded-xl bg-surface-2 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                checked={deleteContent}
                onChange={(e) => setDeleteContent(e.target.checked)}
              />
              <span>
                Also delete everything I’ve posted. Otherwise your posts stay in your friends’
                Habitats, shown as from a “former member”.
              </span>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button variant="danger" onClick={remove} disabled={busy}>
                {busy ? 'Deleting…' : 'Delete everything'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}
