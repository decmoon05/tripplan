import { Suspense } from 'react';
import { LoginForm } from '@/components/features/auth/LoginForm';

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm p-6 pt-20">
      <h1 className="mb-8 text-center text-2xl font-bold">로그인</h1>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
