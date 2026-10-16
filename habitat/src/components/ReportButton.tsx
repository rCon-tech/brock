'use client';

import { Flag } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Label, Textarea } from '@/components/ui/input';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { useHabitat } from '@/modules/sdk/context';

/** "Report to admins": works as a menu item or a standalone button. */
export function ReportButton({
  targetType,
  targetId,
  asMenuItem,
}: {
  targetType: 'record' | 'comment' | 'member';
  targetId: string;
  asMenuItem?: boolean;
}) {
  const { habitatId } = useHabitat();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      await apiFetch(`/api/habitats/${habitatId}/reports`, { method: 'POST', body: { targetType, targetId, reason } });
      toast.success('Thanks. The admins will take a look.');
      setOpen(false);
      setReason('');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {asMenuItem ? (
        <DropdownMenuItem onSelect={() => setOpen(true)}>
          <Flag size={16} /> Report to admins
        </DropdownMenuItem>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Flag size={14} /> Report
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Report to admins" description="Only this Habitat’s admins will see this.">
          <Label htmlFor="why">What’s wrong?</Label>
          <Textarea id="why" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
          <div className="mt-4 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={send} disabled={busy || !reason.trim()}>
              Send report
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
