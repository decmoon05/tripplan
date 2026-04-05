'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Plus, LogOut, User } from 'lucide-react';
import type { AuthUser } from '@/types/auth';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = pathname.startsWith('/auth');
  const isLanding = pathname === '/' || pathname === '/pricing';

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user);
      if (user) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        setIsAdmin(data?.role === 'admin');
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setIsAdmin(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
    router.refresh();
  };

  if (isLanding) return null;

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/">
            <h1 className="text-2xl font-serif italic tracking-tight text-white">Tripplan</h1>
          </Link>
          {!isLoading && user && (
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-white/40">
              <Link href="/dashboard" className="text-white">
                내 여행
              </Link>
              <Link href="/mypage" className="hover:text-white transition-colors">
                마이페이지
              </Link>
              {isAdmin && (
                <Link href="/admin" className="text-orange-400 hover:text-orange-300 transition-colors">
                  관리자
                </Link>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          {isLoading ? null : user ? (
            <>
              <Link
                href="/trips/new"
                className="hidden sm:flex items-center gap-2 px-5 py-2 bg-white text-black rounded-full text-sm font-semibold hover:bg-gray-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                새 여행
              </Link>
              <div className="h-8 w-px bg-white/10 mx-2 hidden sm:block" />
              <button
                type="button"
                onClick={handleSignOut}
                className="p-2 text-white/40 hover:text-white transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center border border-white/10">
                <User className="w-5 h-5 text-white" />
              </div>
            </>
          ) : !isAuthPage ? (
            <Link
              href="/auth/login"
              className="bg-white text-black rounded-full px-6 py-2.5 text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              로그인
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
