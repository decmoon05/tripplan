import { SignupForm } from '@/components/features/auth/SignupForm';

export default function SignupPage() {
  return (
    <main className="mx-auto max-w-sm p-6 pt-20">
      <h1 className="mb-8 text-center text-2xl font-bold">회원가입</h1>
      <SignupForm />
    </main>
  );
}
