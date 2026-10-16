'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/input';
import { ApiError, errorMessage } from '@/lib/api-client';
import { useCreateRecord } from '../../sdk/hooks';
import type { CollectionDef, Field } from '../../sdk/types';

const label = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

/** A form generated from a collection's field definitions. Supports the simple field types. */
export function FormBlock({
  moduleId,
  collection,
  def,
  title,
  submitLabel,
  fields,
}: {
  moduleId: string;
  collection: string;
  def: CollectionDef;
  title?: string;
  submitLabel?: string;
  fields?: string[];
}) {
  const names = (fields ?? Object.keys(def.fields)).filter((n) =>
    [
      'text',
      'longtext',
      'integer',
      'number',
      'boolean',
      'date',
      'datetime',
      'enum',
      'url',
    ].includes(def.fields[n]?.type ?? ''),
  );
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const create = useCreateRecord(moduleId, collection);

  function toData() {
    const data: Record<string, unknown> = {};
    for (const n of names) {
      const f = def.fields[n] as Field;
      const v = values[n];
      if (v === undefined || v === '') continue;
      if (f.type === 'integer' || f.type === 'number') data[n] = Number(v);
      else if (f.type === 'datetime') data[n] = new Date(String(v)).toISOString();
      else data[n] = v;
    }
    return data;
  }

  return (
    <Card>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            { data: toData() },
            {
              onSuccess: () => {
                setValues({});
                setErrors({});
              },
              onError: (err) =>
                err instanceof ApiError && err.fields
                  ? setErrors(err.fields)
                  : toast.error(errorMessage(err)),
            },
          );
        }}
      >
        {title && <h2 className="font-bold">{title}</h2>}
        {names.map((n) => {
          const f = def.fields[n] as Field;
          const id = `f-${collection}-${n}`;
          const required = 'required' in f && !!f.required;
          if (f.type === 'boolean') {
            return (
              <label key={n} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--accent)]"
                  checked={!!values[n]}
                  onChange={(e) => setValues({ ...values, [n]: e.target.checked })}
                />
                {label(n)}
              </label>
            );
          }
          return (
            <div key={n}>
              <Label htmlFor={id}>{label(n)}</Label>
              {f.type === 'longtext' ? (
                <Textarea
                  id={id}
                  maxLength={f.max}
                  value={String(values[n] ?? '')}
                  onChange={(e) => setValues({ ...values, [n]: e.target.value })}
                />
              ) : f.type === 'enum' ? (
                <Select
                  id={id}
                  required={required}
                  value={String(values[n] ?? '')}
                  onChange={(e) => setValues({ ...values, [n]: e.target.value })}
                >
                  <option value="">Choose…</option>
                  {f.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={id}
                  required={required}
                  type={
                    f.type === 'integer' || f.type === 'number'
                      ? 'number'
                      : f.type === 'date'
                        ? 'date'
                        : f.type === 'datetime'
                          ? 'datetime-local'
                          : f.type === 'url'
                            ? 'url'
                            : 'text'
                  }
                  maxLength={f.type === 'text' ? f.max : undefined}
                  value={String(values[n] ?? '')}
                  onChange={(e) => setValues({ ...values, [n]: e.target.value })}
                />
              )}
              <FieldError messages={errors[n]} />
            </div>
          );
        })}
        <Button type="submit" disabled={create.isPending}>
          {submitLabel ?? 'Add'}
        </Button>
      </form>
    </Card>
  );
}
