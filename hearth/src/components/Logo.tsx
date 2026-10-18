export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display text-xl font-bold ${className}`}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M4 15 16 4l12 11v13H4z" fill="#b4553a" />
        <path d="M13 28v-8a3 3 0 0 1 6 0v8z" fill="#fffdf9" />
        <circle cx="22.5" cy="14" r="2" fill="#fffdf9" />
      </svg>
      Hearth
    </span>
  );
}
