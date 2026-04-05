'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';

interface ReminderToggleProps {
  tripId: string;
}

export function ReminderToggle({ tripId }: ReminderToggleProps) {
  const [enabled, setEnabled] = useState(false);
  const [reminderDays, setReminderDays] = useState(3);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/trips/${tripId}/reminder`)
      .then(r => r.json())
      .then(json => {
        if (json.data) {
          setEnabled(json.data.enabled);
          setReminderDays(json.data.reminderDaysBefore);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [tripId]);

  const handleToggle = async () => {
    const newEnabled = !enabled;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/v1/trips/${tripId}/reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled, reminderDaysBefore: reminderDays }),
      });
      if (res.ok) setEnabled(newEnabled);
    } catch {
      // revert on error
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-[#f5f5f5] rounded-xl">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isSaving}
        className={`flex items-center gap-2 text-sm font-medium transition-colors ${
          enabled ? 'text-orange-600' : 'text-black/40 hover:text-black/60'
        } disabled:opacity-50`}
        title="여행 리마인더 (실제 이메일 발송은 Supabase Edge Functions + Resend 연동 필요)"
      >
        {enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
        <span>{enabled ? '리마인더 켜짐' : '리마인더 꺼짐'}</span>
      </button>
      {enabled && (
        <select
          value={reminderDays}
          onChange={async (e) => {
            const days = Number(e.target.value);
            setReminderDays(days);
            await fetch(`/api/v1/trips/${tripId}/reminder`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ enabled: true, reminderDaysBefore: days }),
            });
          }}
          className="text-xs px-2 py-1 border border-black/10 rounded-lg bg-white text-black/60 focus:outline-none"
        >
          <option value={1}>1일 전</option>
          <option value={3}>3일 전</option>
          <option value={7}>7일 전</option>
          <option value={14}>14일 전</option>
        </select>
      )}
      {enabled && (
        <span className="text-[10px] text-black/30">*이메일 발송은 Edge Functions 필요</span>
      )}
    </div>
  );
}
