'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from '@/lib/supabase/auth';
import { loginSchema, type LoginInput } from '@/lib/validators/auth';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await signIn(data.email, data.password);
      const next = searchParams.get('next') || '/dashboard';
      router.push(next);
      router.refresh();
    } catch {
      setErrorMessage('이메일 또는 비밀번호가 올바르지 않습니다');
    } finally {
      setIsSubmitting(false);
    }
  };

  const registered = searchParams.get('registered') === 'true';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {registered && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          회원가입이 완료되었습니다. 로그인해주세요.
        </div>
      )}
      <div>
        <label htmlFor="email" className="block text-xs uppercase tracking-widest text-white/40">
          이메일
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500"
          placeholder="you@example.com"
          {...register('email')}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-xs uppercase tracking-widest text-white/40">
          비밀번호
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500"
          placeholder="••••••••"
          {...register('password')}
        />
        {errors.password && (
          <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>
        )}
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-white py-3.5 font-medium text-black transition hover:bg-white/90 disabled:opacity-50"
      >
        {isSubmitting ? '로그인 중...' : '로그인'}
      </button>

      <p className="text-center text-sm text-white/40">
        계정이 없으신가요?{' '}
        <Link href="/auth/signup" className="font-medium text-orange-500 hover:text-orange-400">
          회원가입
        </Link>
      </p>
    </form>
  );
}
