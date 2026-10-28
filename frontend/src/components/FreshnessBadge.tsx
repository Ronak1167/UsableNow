import React from 'react';
import { Clock, AlertCircle, HelpCircle } from 'lucide-react';
import type { FreshnessLabel } from '../types';

interface FreshnessBadgeProps {
  freshness: FreshnessLabel | string;
  lastReported?: string;
  size?: 'sm' | 'md';
}

export const FreshnessBadge: React.FC<FreshnessBadgeProps> = ({
  freshness,
  lastReported,
  size = 'md',
}) => {
  const norm = (freshness || 'No Evidence').toLowerCase();

  let style = 'bg-slate-100 text-slate-600 border-slate-200';
  let Icon = HelpCircle;

  if (norm === 'fresh') {
    style = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    Icon = Clock;
  } else if (norm === 'stale') {
    style = 'bg-amber-50 text-amber-800 border-amber-200';
    Icon = AlertCircle;
  } else if (norm === 'expired') {
    style = 'bg-rose-50 text-rose-800 border-rose-200';
    Icon = AlertCircle;
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2 py-1 text-xs font-medium';

  let timeString = '';
  if (lastReported) {
    try {
      const d = new Date(lastReported);
      timeString = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      // ignore
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border ${padding} ${style}`}
      title={timeString ? `Last reported: ${timeString}` : undefined}
    >
      <Icon size={13} className="shrink-0" />
      <span>{freshness}</span>
      {timeString && <span className="opacity-70 font-mono text-[10px]">({timeString})</span>}
    </span>
  );
};
