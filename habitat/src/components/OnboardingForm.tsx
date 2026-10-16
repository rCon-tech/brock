'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { ApiError, apiFetch, errorMessage } from '@/lib/api-client';

export function OnboardingForm({ initialName, next }: { initialName: string; next: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/me', { method: 'PATCH', body: { name, onboarded: true } });
      router.push(next);
      router.refresh();
    } catch (err) {
      setBusy(false);
      setError(errorMessage(err));
      if (err instanceof ApiError && err.fields) setFields(err.fields);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="name">What should your friends call you?</Label>
        <Input
          id="name"
          required
          maxLength={60}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <FieldError messages={fields.name} />
        <p className="mt-1 text-xs text-ink-soft">
          You can set a different nickname in each Habitat later.
        </p>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={busy || !name.trim()}>
        Continue
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
