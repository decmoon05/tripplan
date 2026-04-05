'use client';

import { Printer } from 'lucide-react';

export function PrintButton() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-black/60 hover:text-black hover:bg-black/5 rounded-full transition-colors"
      title="인쇄 / PDF 저장"
    >
      <Printer className="w-4 h-4" />
      <span className="hidden sm:inline">인쇄/PDF</span>
    </button>
  );
}
