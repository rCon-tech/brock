'use client';

/** Opens the phone's share sheet with a ready-made nudge (R31); copies it where that isn't available. */
export function ReminderButton({
  message,
  url,
  label,
}: {
  message: string;
  url: string;
  label: string;
}) {
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={async () => {
        if (navigator.share) {
          await navigator.share({ text: message, url }).catch(() => {});
        } else {
          await navigator.clipboard.writeText(`${message} ${url}`).catch(() => {});
          window.alert('Reminder copied. Paste it into a message.');
        }
      }}
    >
      {label}
    </button>
  );
}
