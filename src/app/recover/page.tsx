import { RecoverForm } from '@/components/RecoverForm';

export const metadata = { title: 'Restore your streak' };

export default function RecoverPage() {
  return (
    <section className="mx-auto flex max-w-sm flex-col gap-6 pt-6">
      <div>
        <h1 className="text-3xl font-extrabold">Restore your streak</h1>
        <p className="mt-2 text-brock-muted">
          Playing on a new device or cleared your browser? Enter your handle and the recovery code
          you were given. Your old device will be signed out.
        </p>
      </div>
      <RecoverForm />
    </section>
  );
}
