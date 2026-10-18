'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addDeviceParticipantAction } from '@/app/r/[projectId]/actions';

/** Adds someone who'll share this phone (R17). */
export function AddPersonForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        start(async () => {
          const res = await addDeviceParticipantAction(projectId, name);
          if (!res.ok) return setError(res.error);
          setName('');
          setError(null);
          router.refresh();
        });
      }}
    >
      <div className="flex gap-2">
        <input
          aria-label="Name of the next person"
          className="field"
          placeholder="Add someone sharing this phone"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
        />
        <button type="submit" className="btn btn-secondary" disabled={pending || !name.trim()}>
          Add
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-clay-dark">
          {error}
        </p>
      ) : null}
    </form>
  );
}
