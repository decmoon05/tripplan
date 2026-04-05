'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface LandingNavProps {
  /** 추가 네비게이션 링크 (서비스 소개 등 앵커 링크) */
  extraLinks?: { href: string; label: string }[];
}

export function LandingNav({ extraLinks }: LandingNavProps) {
  const [user, setUser] = useState<{ email?: string; role?: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('user_id', data.user.id)
          .maybeSingle();
        setUser({
          email: data.user.email ?? undefined,
          role: profile?.role ?? 'user',
        });
      }
    });
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div className="max-w-[1200px] mx-auto px-8 h-16 flex items-center justify-between">
        <Link href="/">
          <span className="text-2xl font-serif italic tracking-tight text-white">Tripplan</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          {extraLinks?.map((link) => (
            <a key={link.href} href={link.href} className="text-[14px] text-white/70 hover:text-white transition-colors">
              {link.label}
            </a>
          ))}
          <Link href="/pricing" className="text-[14px] text-white/70 hover:text-white transition-colors">요금제</Link>

          {user ? (
            <>
              <Link href="/dashboard" className="flex items-center gap-1.5 text-[14px] text-white/70 hover:text-white transition-colors">
                <LayoutDashboard size={14} />
                대시보드
              </Link>
              {(user.role === 'admin' || user.role === 'developer') && (
                <Link href="/admin" className="text-[14px] text-orange-400 hover:text-orange-300 transition-colors">
                  관리자
                </Link>
              )}
              <Link href="/mypage" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-[13px] text-white/90 hover:bg-white/20 transition-colors">
                <User size={14} />
                {user.email?.split('@')[0] ?? '내 계정'}
              </Link>
            </>
          ) : (
            <Link href="/auth/login" className="text-[14px] text-white/70 hover:text-white transition-colors">로그인</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
