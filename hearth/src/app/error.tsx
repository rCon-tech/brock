'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mt-6 flex flex-col gap-3 p-6" role="alert">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted">Your swipes are safe. Please try again.</p>
      <button type="button" className="btn btn-primary self-start" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
