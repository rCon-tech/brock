'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { useHabitat } from '@/modules/sdk/context';

export function NicknameForm({ initial }: { initial: string }) {
  const { habitatId, me } = useHabitat();
  const router = useRouter();
  const [value, setValue] = useState(initial);
  async function save() {
    try {
      await apiFetch(`/api/habitats/${habitatId}/members/${me.id}`, { method: 'PATCH', body: { nickname: value.trim() || null } });
      toast.success('Saved');
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <div className="max-w-sm">
      <Label htmlFor="nick">Your nickname in this Habitat</Label>
      <div className="flex gap-2">
        <Input id="nick" value={value} maxLength={40} placeholder="Optional" onChange={(e) => setValue(e.target.value)} />
        <Button onClick={save} disabled={value === initial}>
          Save
        </Button>
      </div>
    </div>
  );
}
