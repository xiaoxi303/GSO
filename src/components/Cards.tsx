'use client';

import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glass-card p-4 flex flex-col gap-2", className)} {...props}>
      {children}
    </div>
  );
}

export function Badge({ children, variant = 'neutral', className }: {
  children: React.ReactNode;
  variant?: 'bullish' | 'bearish' | 'neutral' | 'info' | 'warn' | 'extreme';
  className?: string;
}) {
  const styles = {
    bullish: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    bearish: 'bg-red-500/10 text-red-400 border border-red-500/20',
    neutral: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
    info: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    warn: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    extreme: 'bg-red-600 text-white font-bold border border-red-500 animate-pulse',
  };

  return (
    <span className={cn("text-xs px-2 py-0.5 rounded font-medium tracking-wide whitespace-nowrap inline-flex items-center gap-1", styles[variant], className)}>
      {children}
    </span>
  );
}

export function PriceTag({ val, pct, isMacro = false }: { val: number; pct: number; isMacro?: boolean }) {
  const isUp = pct > 0;
  const isZero = pct === 0;
  
  return (
    <div className="flex flex-col items-end">
      <span className="text-sm font-semibold tracking-tight font-mono">
        {val.toLocaleString(undefined, { minimumFractionDigits: isMacro ? 3 : 2 })}
      </span>
      <span className={cn(
        "text-xs font-medium flex items-center font-mono",
        isUp ? "text-emerald-400" : isZero ? "text-gray-400" : "text-red-400"
      )}>
        {isUp ? <ArrowUpRight className="w-3 h-3 inline" /> : isZero ? <Minus className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
        {isUp ? '+' : ''}{pct.toFixed(2)}%
      </span>
    </div>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-bold tracking-wider text-gray-300 uppercase flex items-center gap-2">
        <span className="w-1 h-4 bg-emerald-500 rounded-full"></span>
        {title}
      </h2>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}
