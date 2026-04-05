'use client';

import { Phone, Shield } from 'lucide-react';
import { findEmergencyContact } from '@/lib/data/emergency-contacts';

interface Props {
  destination: string;
}

export function EmergencyInfo({ destination }: Props) {
  const contact = findEmergencyContact(destination);
  if (!contact) return null;

  return (
    <div className="pt-6 border-t border-black/5">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-orange-500" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-black/80">비상 연락처</h3>
        <span className="ml-auto text-[10px] text-black/30">{contact.country}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <EmergencyItem label="경찰" number={contact.police} />
        <EmergencyItem label="구급대" number={contact.ambulance} />
        <EmergencyItem label="소방서" number={contact.fire} />
        <EmergencyItem label="한국 대사관" number={contact.embassy} small />
      </div>
      {contact.touristPolice && (
        <div className="flex items-center gap-2 text-xs text-black/40 mt-2">
          <Phone className="w-3 h-3" />
          <span>관광경찰: {contact.touristPolice}</span>
        </div>
      )}
      {contact.hospitalTip && (
        <p className="text-[11px] text-black/30 mt-2 bg-black/[0.02] rounded-lg px-3 py-2 border border-black/5">
          🏥 {contact.hospitalTip}
        </p>
      )}
    </div>
  );
}

function EmergencyItem({ label, number, small = false }: { label: string; number: string; small?: boolean }) {
  return (
    <a
      href={`tel:${number.replace(/[^0-9+]/g, '')}`}
      className="flex flex-col items-center gap-1 bg-red-500/5 border border-red-500/10 rounded-xl p-3 hover:bg-red-500/10 transition-colors group"
    >
      <Phone className="w-3.5 h-3.5 text-red-400 group-hover:text-red-500 transition-colors" />
      <span className="text-[10px] font-semibold text-black/50 uppercase tracking-wide">{label}</span>
      <span className={`font-bold text-red-500 ${small ? 'text-[10px]' : 'text-sm'} text-center leading-tight`}>
        {number}
      </span>
    </a>
  );
}
