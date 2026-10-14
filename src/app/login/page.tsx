import { LoginForm } from '@/components/LoginForm';

export const metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <section className="mx-auto flex max-w-sm flex-col gap-6 pt-6">
      <div>
        <h1 className="text-3xl font-extrabold">Log in</h1>
        <p className="mt-2 text-brock-muted">
          New phone or cleared your browser? Enter your username to pick up your streak.
        </p>
      </div>
      <LoginForm />
    </section>
  );
}
