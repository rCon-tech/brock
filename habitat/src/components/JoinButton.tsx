'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError, apiFetch, errorMessage } from '@/lib/api-client';

export function JoinButton({ code, name }: { code: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const { slug } = await apiFetch<{ slug: string }>(`/api/invites/${code}`, { method: 'POST' });
      router.push(`/h/${slug}`);
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiError && e.code === 'already_member') return router.push('/');
      setError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-2">
      <Button size="lg" className="w-full" disabled={busy} onClick={join}>
        {busy ? 'Joining…' : `Join ${name}`}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
