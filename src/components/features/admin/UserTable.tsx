'use client';

import { useState } from 'react';
import type { UserRole, UserPlan } from '@/types/database';

export interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
  plan: UserPlan;
  todayUsage: number;
  totalTrips: number;
}

interface UserTableProps {
  users: AdminUser[];
  dailyLimit: number;
  onRoleChange: (userId: string, role: UserRole) => Promise<void>;
  onPlanChange: (userId: string, plan: UserPlan) => Promise<void>;
  currentUserId: string;
}

const ROLES: UserRole[] = ['user', 'developer', 'admin'];
const PLANS: { value: UserPlan; label: string; color: string }[] = [
  { value: 'free', label: 'Free', color: 'text-white/50' },
  { value: 'pro', label: 'Pro', color: 'text-orange-400' },
  { value: 'team', label: 'Team', color: 'text-purple-400' },
];

const ROLE_BADGE: Record<UserRole, { label: string; color: string }> = {
  user: { label: 'User', color: 'bg-white/10 text-white/50' },
  developer: { label: 'Dev', color: 'bg-blue-500/20 text-blue-400' },
  admin: { label: 'Admin', color: 'bg-orange-500/20 text-orange-400' },
};

const PLAN_BADGE: Record<UserPlan, { label: string; color: string }> = {
  free: { label: 'Free', color: 'bg-white/10 text-white/40' },
  pro: { label: 'Pro', color: 'bg-orange-500/20 text-orange-400' },
  team: { label: 'Team', color: 'bg-purple-500/20 text-purple-400' },
};

export function UserTable({ users, dailyLimit, onRoleChange, onPlanChange, currentUserId }: UserTableProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setUpdatingId(userId);
    setErrorMsg(null);
    try {
      await onRoleChange(userId, newRole);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '역할 변경에 실패했습니다');
    } finally {
      setUpdatingId(null);
    }
  }

  async function handlePlanChange(userId: string, newPlan: UserPlan) {
    setUpdatingId(userId);
    setErrorMsg(null);
    try {
      await onPlanChange(userId, newPlan);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '요금제 변경에 실패했습니다');
    } finally {
      setUpdatingId(null);
    }
  }

  // 통계
  const planCounts = { free: 0, pro: 0, team: 0 };
  const roleCounts = { user: 0, developer: 0, admin: 0 };
  for (const u of users) {
    planCounts[u.plan || 'free']++;
    roleCounts[u.role]++;
  }

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {PLANS.map((p) => (
          <div key={p.value} className="bg-white/[0.04] rounded-xl p-3 border border-white/10 text-center">
            <p className="text-[10px] text-white/40 font-bold uppercase">{p.label}</p>
            <p className={`text-xl font-bold ${p.color}`}>{planCounts[p.value]}</p>
          </div>
        ))}
        {Object.entries(ROLE_BADGE).map(([role, badge]) => (
          <div key={role} className="bg-white/[0.04] rounded-xl p-3 border border-white/10 text-center">
            <p className="text-[10px] text-white/40 font-bold uppercase">{badge.label}</p>
            <p className={`text-xl font-bold ${badge.color.split(' ')[1]}`}>{roleCounts[role as UserRole]}</p>
          </div>
        ))}
      </div>

      {/* 테이블 */}
      <div className="rounded-xl border border-white/10 bg-white/[0.04]">
        {errorMsg && (
          <div className="mx-5 mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {errorMsg}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-white/50">
                <th className="px-5 py-3 font-medium">이메일</th>
                <th className="px-5 py-3 font-medium">역할</th>
                <th className="px-5 py-3 font-medium">요금제</th>
                <th className="px-5 py-3 font-medium">오늘 사용량</th>
                <th className="px-5 py-3 font-medium">총 여행</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                const isExempt = u.role === 'developer' || u.role === 'admin';
                const plan = u.plan || 'free';
                return (
                  <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.04]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{u.email}</span>
                        {isSelf && (
                          <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] text-blue-400 font-bold">나</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={u.role}
                        disabled={isSelf || updatingId === u.id}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                        className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-sm disabled:opacity-50"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r} className="bg-[#1a1a1a] text-white">{ROLE_BADGE[r].label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={plan}
                        disabled={updatingId === u.id}
                        onChange={(e) => handlePlanChange(u.id, e.target.value as UserPlan)}
                        className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-sm disabled:opacity-50"
                      >
                        {PLANS.map((p) => (
                          <option key={p.value} value={p.value} className="bg-[#1a1a1a] text-white">{p.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <span className={isExempt || plan !== 'free' ? 'text-green-400' : 'text-white/60'}>
                        {u.todayUsage}
                        {isExempt ? ' (무제한)' : plan === 'pro' ? '/30' : plan === 'team' ? '/100' : `/${dailyLimit}`}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-white/60">{u.totalTrips}</td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-white/40">
                    등록된 유저가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {updatingId && (
          <div className="px-5 py-2 text-xs text-white/40 border-t border-white/[0.04]">저장 중...</div>
        )}
      </div>
    </div>
  );
}
