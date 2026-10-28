import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import type { ConfidenceLabel } from '../types';

interface ConfidenceBadgeProps {
  label: ConfidenceLabel | string;
  score?: number;
  size?: 'sm' | 'md';
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  label,
  score,
  size = 'md',
}) => {
  const norm = (label || 'Unknown').toLowerCase();

  let colorStyle = 'text-slate-600 bg-slate-100 border-slate-200';
  let Icon = ShieldQuestion;

  if (norm === 'high') {
    colorStyle = 'text-teal-800 bg-teal-50 border-teal-200';
    Icon = ShieldCheck;
  } else if (norm === 'medium') {
    colorStyle = 'text-sky-800 bg-sky-50 border-sky-200';
    Icon = ShieldCheck;
  } else if (norm === 'low') {
    colorStyle = 'text-amber-800 bg-amber-50 border-amber-200';
    Icon = ShieldAlert;
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs sm:text-sm font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border ${padding} ${colorStyle}`}
      title={score !== undefined ? `Confidence score: ${score}%` : `Confidence: ${label}`}
    >
      <Icon size={14} className="shrink-0" aria-hidden="true" />
      <span>{label} Confidence</span>
      {score !== undefined && score > 0 && (
        <span className="opacity-75 text-[11px] font-mono">({score}%)</span>
      )}
    </span>
  );
};
