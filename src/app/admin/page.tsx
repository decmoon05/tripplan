'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { StatsCards } from '@/components/features/admin/StatsCards';
import { UsageChart } from '@/components/features/admin/UsageChart';
import { UserTable, type AdminUser } from '@/components/features/admin/UserTable';
import { AILogPanel } from '@/components/features/admin/AILogPanel';
import { ConfigPanel } from '@/components/features/admin/ConfigPanel';
import { HealthPanel } from '@/components/features/admin/HealthPanel';
import { CachePanel } from '@/components/features/admin/CachePanel';
import { ErrorLogPanel } from '@/components/features/admin/ErrorLogPanel';
import { TestPanel } from '@/components/features/admin/TestPanel';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import type { UserRole, UserPlan } from '@/types/database';

type AdminTab = 'overview' | 'users' | 'ai-logs' | 'config' | 'health' | 'cache' | 'errors' | 'test';

interface StatsData {
  todayUsage: number;
  weekUsage: number;
  totalUsers: number;
  totalTrips: number;
  dailyUsage: { date: string; count: number }[];
  dailyLimit: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      const [statsRes, usersRes] = await Promise.all([
        fetch('/api/v1/admin/stats'),
        fetch('/api/v1/admin/users'),
      ]);

      if (statsRes.status === 403 || usersRes.status === 403) {
        setError('관리자 권한이 필요합니다');
        return;
      }

      const statsJson = await statsRes.json();
      const usersJson = await usersRes.json();

      if (!statsJson.success) throw new Error(statsJson.error?.message);
      if (!usersJson.success) throw new Error(usersJson.error?.message);

      setStats(statsJson.data);
      setUsers(usersJson.data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleRoleChange(userId: string, role: UserRole) {
    const res = await fetch('/api/v1/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
  }

  async function handlePlanChange(userId: string, plan: UserPlan) {
    const res = await fetch('/api/v1/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, plan }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, plan } : u)));
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
      <LoadingSpinner message="관리자 데이터 로딩 중..." />
    </div>
  );
  if (error) return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-6xl p-6">
        <ErrorMessage message={error} onRetry={fetchData} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">관리자 대시보드</h1>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-white/10 overflow-x-auto">
        {([
          { id: 'overview' as AdminTab, label: '📊 개요' },
          { id: 'users' as AdminTab, label: '👥 유저' },
          { id: 'ai-logs' as AdminTab, label: '🤖 AI 로그' },
          { id: 'config' as AdminTab, label: '⚙️ 설정' },
          { id: 'health' as AdminTab, label: '🏥 헬스' },
          { id: 'cache' as AdminTab, label: '💾 캐시' },
          { id: 'errors' as AdminTab, label: '❌ 에러' },
          { id: 'test' as AdminTab, label: '🧪 테스트' },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {stats && (
            <>
              <StatsCards
                todayUsage={stats.todayUsage}
                weekUsage={stats.weekUsage}
                totalUsers={stats.totalUsers}
                totalTrips={stats.totalTrips}
              />
              <UsageChart dailyUsage={stats.dailyUsage} />
            </>
          )}
        </>
      )}

      {activeTab === 'users' && (
        <UserTable
          users={users}
          dailyLimit={stats?.dailyLimit ?? 10}
          onRoleChange={handleRoleChange}
          onPlanChange={handlePlanChange}
          currentUserId={currentUserId}
        />
      )}

      {activeTab === 'ai-logs' && <AILogPanel />}
      {activeTab === 'config' && <ConfigPanel />}
      {activeTab === 'health' && <HealthPanel />}
      {activeTab === 'cache' && <CachePanel />}
      {activeTab === 'errors' && <ErrorLogPanel />}
      {activeTab === 'test' && <TestPanel />}
    </div>
    </div>
  );
}
