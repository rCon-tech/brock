'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { MemberAvatar, displayName } from '@/components/MemberAvatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { FieldError, Input, Label, Select } from '@/components/ui/input';
import { ApiError, errorMessage } from '@/lib/api-client';
import { useHabitat } from '../sdk/context';
import { useCreateRecord } from '../sdk/hooks';
import { parseMoneyInput } from './settle';

export const CURRENCIES = ['GBP', 'EUR', 'USD', 'CAD', 'AUD', 'JPY'];

export function ExpenseForm({ open, onOpenChange, defaultCurrency }: { open: boolean; onOpenChange: (o: boolean) => void; defaultCurrency: string }) {
  const { me, members } = useHabitat();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [paidBy, setPaidBy] = useState(me.id);
  const [among, setAmong] = useState(new Set(members.map((m) => m.id)));
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const create = useCreateRecord('split-costs', 'expense');
  const minor = parseMoneyInput(amount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add an expense" description="It’s split equally between the people you tick.">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!minor) return;
            create.mutate(
              { data: { description, amount: { amountMinor: minor, currency }, paidBy, splitAmong: [...among] } },
              {
                onSuccess: () => onOpenChange(false),
                onError: (err) => (err instanceof ApiError && err.fields ? setFields(err.fields) : toast.error(errorMessage(err))),
              },
            );
          }}
        >
          <div>
            <Label htmlFor="xd">What was it?</Label>
            <Input id="xd" required maxLength={100} placeholder="Dinner at Luigi’s" value={description} onChange={(e) => setDescription(e.target.value)} />
            <FieldError messages={fields.description} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label htmlFor="xa">Amount</Label>
              <Input id="xa" inputMode="decimal" required placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
              {amount && !minor && <p className="mt-1 text-sm text-danger">Use a number like 12.50</p>}
            </div>
            <div>
              <Label htmlFor="xc">Currency</Label>
              <Select id="xc" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="xp">Paid by</Label>
            <Select id="xp" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === me.id ? 'You' : displayName(m)}
                </option>
              ))}
            </Select>
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Split between</legend>
            <ul className="grid gap-1 sm:grid-cols-2">
              {members.map((m) => (
                <li key={m.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 hover:bg-surface-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--accent)]"
                      checked={among.has(m.id)}
                      onChange={(e) => {
                        const next = new Set(among);
                        if (e.target.checked) next.add(m.id);
                        else next.delete(m.id);
                        setAmong(next);
                      }}
                    />
                    <MemberAvatar member={m} size="xs" /> <span className="truncate text-sm">{m.id === me.id ? 'You' : displayName(m)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <FieldError messages={fields.splitAmong} />
          </fieldset>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={create.isPending || !description.trim() || !minor || among.size === 0}>
              Add expense
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
