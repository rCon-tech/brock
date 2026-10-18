import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card mt-6 flex flex-col gap-3 p-6">
      <h1 className="text-2xl font-bold">We can’t find that</h1>
      <p className="text-muted">The page may have moved, or the link may not be for you.</p>
      <Link href="/" className="btn btn-primary self-start">
        Back to Hearth
      </Link>
    </div>
  );
}
