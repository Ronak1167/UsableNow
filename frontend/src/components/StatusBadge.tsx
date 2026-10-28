import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import type { EvaluatedStatus } from '../types';

interface StatusBadgeProps {
  status: EvaluatedStatus | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
}) => {
  const normStatus = (status || 'UNKNOWN').toUpperCase();

  let bg = 'bg-slate-100 text-slate-700 border-slate-300';
  let label = 'Unknown Status';
  let Icon = HelpCircle;

  if (normStatus === 'LIKELY_WORKING') {
    bg = 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-200';
    label = 'Likely Working';
    Icon = CheckCircle2;
  } else if (normStatus === 'LIKELY_UNAVAILABLE') {
    bg = 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-200';
    label = 'Likely Unavailable';
    Icon = XCircle;
  } else if (normStatus === 'CONFLICTING') {
    bg = 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-200';
    label = 'Conflicting Reports';
    Icon = AlertTriangle;
  } else {
    bg = 'bg-slate-100 text-slate-700 border-slate-300';
    label = 'Unknown (Unconfirmed)';
    Icon = HelpCircle;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs sm:text-sm px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm sm:text-base px-3.5 py-1.5 gap-2 font-semibold',
  }[size];

  const iconSizes = {
    sm: 13,
    md: 16,
    lg: 18,
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-xs transition-colors ${sizeClasses} ${bg}`}
      role="status"
      aria-label={`Facility status: ${label}`}
    >
      {showIcon && <Icon size={iconSizes} className="shrink-0" aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
};
