import { LoginForm } from '@/components/LoginForm';

export const metadata = { title: 'Log in' };

export default function LoginPage() {
  return (
    <section className="flex w-full max-w-sm flex-col gap-5 pt-4">
      <h1 className="comic-heading -rotate-2 text-center text-6xl">LOG IN</h1>
      <div className="panel flex flex-col gap-4 p-5">
        <p className="text-[15px]">
          New phone or cleared your browser? Enter your username to pick up where you left off.
        </p>
        <LoginForm />
      </div>
    </section>
  );
}
