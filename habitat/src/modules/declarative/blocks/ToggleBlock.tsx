'use client';

import { toast } from 'sonner';
import { errorMessage } from '@/lib/api-client';
import { useUpdateRecord } from '../../sdk/hooks';

/** A checkbox bound to a yes/no field of a record. */
export function ToggleBlock({
  moduleId,
  recordId,
  field,
  value,
  label,
}: {
  moduleId: string;
  recordId: string;
  field: string;
  value: boolean;
  label: string;
}) {
  const update = useUpdateRecord(moduleId);
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="h-5 w-5 shrink-0 accent-[var(--accent)]"
      checked={value}
      disabled={update.isPending}
      onChange={(e) =>
        update.mutate(
          { id: recordId, data: { [field]: e.target.checked } },
          { onError: (err) => toast.error(errorMessage(err)) },
        )
      }
    />
  );
}
