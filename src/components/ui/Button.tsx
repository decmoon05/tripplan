'use client';

import type { ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps {
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-white text-black hover:bg-gray-200 disabled:bg-gray-600 disabled:text-gray-400',
  secondary: 'bg-white/10 text-white hover:bg-white/20 disabled:bg-white/5 disabled:text-white/30',
  danger: 'bg-rose-500 text-white hover:bg-rose-600 disabled:bg-rose-800 disabled:text-rose-300',
};

export function Button({ variant = 'primary', children, className = '', disabled, type = 'button', onClick }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-6 py-3 text-sm font-semibold transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100 ${VARIANT_STYLES[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
