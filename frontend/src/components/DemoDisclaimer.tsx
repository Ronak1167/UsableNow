import React from 'react';
import { Info } from 'lucide-react';

export const DemoDisclaimer: React.FC = () => {
  return (
    <div
      className="bg-amber-50/90 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs sm:text-sm"
      role="region"
      aria-label="Demonstration data notice"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Info size={16} className="text-amber-700 shrink-0" aria-hidden="true" />
          <span>
            <strong>Demonstration Dataset (Lumina '26):</strong> Facilities and statuses represent illustrative mock data for JIIT campus areas until verified through actual on-site student observations.
          </span>
        </div>
        <span className="hidden md:inline-block shrink-0 px-2 py-0.5 bg-amber-200/80 rounded font-mono text-[11px] font-semibold text-amber-900">
          DEMO DATA
        </span>
      </div>
    </div>
  );
};
