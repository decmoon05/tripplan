'use client';

import { useState } from 'react';
import { CheckSquare, Square, Plus, Trash2, ClipboardList } from 'lucide-react';
import { useChecklist, useAddChecklistItem, useToggleChecklistItem, useDeleteChecklistItem } from '@/hooks/useChecklist';
import type { ChecklistCategory } from '@/types/database';

const CATEGORIES: ChecklistCategory[] = ['서류', '의류', '전자기기', '의약품', '기타'];

const CATEGORY_COLORS: Record<ChecklistCategory, string> = {
  '서류': 'bg-blue-500/10 text-blue-600',
  '의류': 'bg-purple-500/10 text-purple-600',
  '전자기기': 'bg-orange-500/10 text-orange-600',
  '의약품': 'bg-red-500/10 text-red-600',
  '기타': 'bg-black/5 text-black/50',
};

const DEFAULT_ITEMS: { item: string; category: ChecklistCategory }[] = [
  { item: '여권', category: '서류' },
  { item: '비자', category: '서류' },
  { item: '항공권', category: '서류' },
  { item: '여행자보험', category: '서류' },
  { item: '충전기', category: '전자기기' },
  { item: '보조배터리', category: '전자기기' },
  { item: '상비약', category: '의약품' },
  { item: '썬크림', category: '의약품' },
];

interface ChecklistPanelProps {
  tripId: string;
}

export function ChecklistPanel({ tripId }: ChecklistPanelProps) {
  const { data: items = [], isLoading } = useChecklist(tripId);
  const addItem = useAddChecklistItem(tripId);
  const toggleItem = useToggleChecklistItem(tripId);
  const deleteItem = useDeleteChecklistItem(tripId);

  const [newItemText, setNewItemText] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<ChecklistCategory>('기타');
  const [activeCategory, setActiveCategory] = useState<ChecklistCategory | 'all'>('all');
  const [isAddingDefaults, setIsAddingDefaults] = useState(false);

  const filteredItems = activeCategory === 'all' ? items : items.filter(i => i.category === activeCategory);
  const checkedCount = items.filter(i => i.checked).length;

  const handleAdd = async () => {
    if (!newItemText.trim()) return;
    await addItem.mutateAsync({ item: newItemText.trim(), category: newItemCategory });
    setNewItemText('');
  };

  const handleAddDefaults = async () => {
    setIsAddingDefaults(true);
    for (const defaultItem of DEFAULT_ITEMS) {
      const exists = items.some(i => i.item === defaultItem.item);
      if (!exists) {
        await addItem.mutateAsync(defaultItem);
      }
    }
    setIsAddingDefaults(false);
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
      {/* Progress */}
      <div className="bg-white rounded-2xl p-6 border border-black/5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold text-black">준비물 체크리스트</h3>
          </div>
          <span className="text-sm font-medium text-black/60">
            {checkedCount}/{items.length} 완료
          </span>
        </div>
        <div className="w-full bg-black/5 rounded-full h-2">
          <div
            className="bg-orange-500 h-2 rounded-full transition-all duration-300"
            style={{ width: items.length > 0 ? `${(checkedCount / items.length) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            activeCategory === 'all'
              ? 'bg-black text-white'
              : 'bg-white border border-black/10 text-black/60 hover:bg-black/5'
          }`}
        >
          전체 ({items.length})
        </button>
        {CATEGORIES.map((cat) => {
          const count = items.filter(i => i.category === cat).length;
          if (count === 0) return null;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeCategory === cat
                  ? 'bg-black text-white'
                  : 'bg-white border border-black/10 text-black/60 hover:bg-black/5'
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Add new item */}
      <div className="bg-white rounded-2xl p-4 border border-black/5 shadow-sm space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="준비물 추가..."
            className="flex-1 text-sm px-3 py-2 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-[#f5f5f5]"
          />
          <select
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value as ChecklistCategory)}
            className="text-sm px-3 py-2 border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-[#f5f5f5]"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newItemText.trim() || addItem.isPending}
            className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {items.length === 0 && (
          <button
            type="button"
            onClick={handleAddDefaults}
            disabled={isAddingDefaults}
            className="w-full text-sm text-orange-600 hover:text-orange-700 font-medium py-1"
          >
            {isAddingDefaults ? '추가 중...' : '기본 준비물 자동 추가'}
          </button>
        )}
      </div>

      {/* Items list */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-8 text-black/40 text-sm">
          준비물을 추가해보세요
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-black/5 group hover:border-black/10 transition-colors"
            >
              <button
                type="button"
                onClick={() => toggleItem.mutate({ itemId: item.id, checked: !item.checked })}
                className="text-orange-500 hover:text-orange-600 transition-colors flex-shrink-0"
              >
                {item.checked ? (
                  <CheckSquare className="w-5 h-5" />
                ) : (
                  <Square className="w-5 h-5 text-black/20 hover:text-orange-400" />
                )}
              </button>
              <span className={`flex-1 text-sm ${item.checked ? 'line-through text-black/30' : 'text-black'}`}>
                {item.item}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[item.category]}`}>
                {item.category}
              </span>
              <button
                type="button"
                onClick={() => deleteItem.mutate(item.id)}
                className="opacity-0 group-hover:opacity-100 text-black/20 hover:text-red-500 transition-all"
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
