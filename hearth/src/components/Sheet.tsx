'use client';

import { useEffect, useRef } from 'react';

/** A bottom sheet built on the native <dialog>, so focus handling and Escape come for free. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="fixed inset-x-0 bottom-0 m-0 mx-auto max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-sand bg-paper p-5 text-ink backdrop:bg-ink/40 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
    >
      {open ? children : null}
    </dialog>
  );
}
