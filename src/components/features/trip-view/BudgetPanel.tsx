'use client';

import { useState } from 'react';
import { DollarSign, Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { useExpenses, useAddExpense, useDeleteExpense } from '@/hooks/useExpenses';
import type { ExpenseCategory, TripItem } from '@/types/database';
import { toKRW } from '@/utils/currency';

const EXPENSE_CATEGORIES: ExpenseCategory[] = ['숙박', '교통', '식비', '관광', '쇼핑', '기타'];

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  '숙박': 'bg-blue-500/10 text-blue-600',
  '교통': 'bg-green-500/10 text-green-600',
  '식비': 'bg-orange-500/10 text-orange-600',
  '관광': 'bg-purple-500/10 text-purple-600',
  '쇼핑': 'bg-pink-500/10 text-pink-600',
  '기타': 'bg-black/5 text-black/50',
};

interface BudgetPanelProps {
  tripId: string;
  items: TripItem[];
}

export function BudgetPanel({ tripId, items }: BudgetPanelProps) {
  const { data: expenses = [], isLoading } = useExpenses(tripId);
  const addExpense = useAddExpense(tripId);
  const deleteExpense = useDeleteExpense(tripId);

  const [form, setForm] = useState({
    category: '기타' as ExpenseCategory,
    amount: '',
    currency: 'KRW',
    memo: '',
    date: '',
  });

  // Calculate estimated cost from trip items (in KRW)
  const estimatedTotal = items.reduce((sum, item) => {
    const krw = item.currency === 'KRW'
      ? item.estimatedCost
      : (toKRW(item.estimatedCost, item.currency || 'KRW') ?? item.estimatedCost);
    return sum + krw;
  }, 0);

  // Calculate actual spending (in KRW)
  const actualTotal = expenses.reduce((sum, exp) => {
    const krw = exp.currency === 'KRW'
      ? exp.amount
      : (toKRW(exp.amount, exp.currency) ?? exp.amount);
    return sum + krw;
  }, 0);

  const diff = actualTotal - estimatedTotal;
  const diffPercent = estimatedTotal > 0 ? ((diff / estimatedTotal) * 100).toFixed(1) : '0';

  const handleAdd = async () => {
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) return;
    await addExpense.mutateAsync({
      category: form.category,
      amount,
      currency: form.currency,
      memo: form.memo || undefined,
      date: form.date || undefined,
    });
    setForm({ category: '기타', amount: '', currency: 'KRW', memo: '', date: '' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Budget Overview */}
      <div className="bg-white rounded-2xl p-6 border border-black/5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-orange-500" />
          <h3 className="font-semibold text-black">예산 현황</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-[#f5f5f5] rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">예상 비용</p>
            <p className="text-lg font-semibold text-black">₩{Math.round(estimatedTotal).toLocaleString()}</p>
          </div>
          <div className="text-center p-4 bg-[#f5f5f5] rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">실제 지출</p>
            <p className="text-lg font-semibold text-black">₩{Math.round(actualTotal).toLocaleString()}</p>
          </div>
          <div className={`text-center p-4 rounded-xl ${diff > 0 ? 'bg-red-50' : diff < 0 ? 'bg-green-50' : 'bg-[#f5f5f5]'}`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">차이</p>
            <div className="flex items-center justify-center gap-1">
              {diff > 0 ? <TrendingUp className="w-4 h-4 text-red-500" /> : diff < 0 ? <TrendingDown className="w-4 h-4 text-green-500" /> : null}
              <p className={`text-lg font-semibold ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-black'}`}>
                {diff > 0 ? '+' : ''}{Math.round(diff).toLocaleString()} <span className="text-xs">({diffPercent}%)</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Expense Form */}
      <div className="bg-white rounded-2xl p-4 border border-black/5 shadow-sm space-y-3">
        <p className="text-xs font-semibold text-black/50 uppercase tracking-widest">지출 추가</p>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={form.category}
            onChange={(e) => setForm(f => ({ ...f, category: e.target.value as ExpenseCategory }))}
            className="text-sm px-3 py-2 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-[#f5f5f5]"
          >
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <div className="flex gap-1">
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="금액"
              min="0"
              className="flex-1 text-sm px-3 py-2 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-[#f5f5f5]"
            />
            <select
              value={form.currency}
              onChange={(e) => setForm(f => ({ ...f, currency: e.target.value }))}
              className="text-sm px-2 py-2 border border-black/10 rounded-xl focus:outline-none bg-[#f5f5f5] w-20"
            >
              {['KRW', 'USD', 'EUR', 'JPY', 'CNY', 'THB', 'VND'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={form.memo}
            onChange={(e) => setForm(f => ({ ...f, memo: e.target.value }))}
            placeholder="메모 (선택)"
            className="flex-1 text-sm px-3 py-2 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-[#f5f5f5]"
          />
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
            className="text-sm px-3 py-2 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-[#f5f5f5]"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!form.amount || addExpense.isPending}
            className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expenses list */}
      {expenses.length === 0 ? (
        <div className="text-center py-8 text-black/40 text-sm">
          아직 지출 내역이 없습니다
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-black/5 group hover:border-black/10 transition-colors"
            >
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${CATEGORY_COLORS[expense.category]}`}>
                {expense.category}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-black">
                  {expense.currency === 'KRW' ? '₩' : ''}{expense.amount.toLocaleString()} {expense.currency !== 'KRW' && expense.currency}
                </p>
                {expense.memo && <p className="text-xs text-black/40 truncate">{expense.memo}</p>}
              </div>
              {expense.date && (
                <span className="text-xs text-black/40 flex-shrink-0">{expense.date}</span>
              )}
              <button
                type="button"
                onClick={() => deleteExpense.mutate(expense.id)}
                className="opacity-0 group-hover:opacity-100 text-black/20 hover:text-red-500 transition-all flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
