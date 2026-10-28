import React from 'react';
import { MapPin, Clock, ArrowRight, PlusCircle, CheckCircle, XCircle, AlertTriangle, HelpCircle, WashingMachine, Users, Navigation } from 'lucide-react';
import type { FacilityCard as FacilityCardType } from '../types';
import { StatusBadge } from './StatusBadge';
import { ConfidenceBadge } from './ConfidenceBadge';
import { FreshnessBadge } from './FreshnessBadge';

interface FacilityCardProps {
  facility: FacilityCardType;
  onSelect: (facilityId: string) => void;
  onReport: (facilityId: string, featureId?: string) => void;
}

export const FacilityCard: React.FC<FacilityCardProps> = ({
  facility,
  onSelect,
  onReport,
}) => {
  const primaryAssessment = facility.feature_assessments?.[0];
  const isLaundry = Boolean(
    facility.facility_type === 'Campus Laundry' ||
    facility.features.some((f) => f.feature_type.includes('laundry'))
  );

  const crowdAssessment = facility.feature_assessments.find((f) => f.feature_type === 'laundry_crowd');
  const derivedCrowd: string | null = crowdAssessment
    ? crowdAssessment.status === 'LIKELY_WORKING' ? 'Low' :
      crowdAssessment.status === 'LIKELY_UNAVAILABLE' ? 'High' :
      crowdAssessment.status === 'CONFLICTING' ? 'Conflicting' : 'Unknown'
    : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group">
      {/* Top Banner & Badges */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded mb-1">
              {isLaundry && <WashingMachine size={12} className="text-cyan-700" />}
              <span>{facility.facility_type}</span>
            </span>
            <h3 className="font-bold text-base sm:text-lg text-slate-900 group-hover:text-teal-700 transition-colors">
              {facility.name}
            </h3>
          </div>
          <StatusBadge status={facility.primary_status} size="sm" />
        </div>

        {/* Location & Hours */}
        <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500 mb-3">
          <span className="flex items-center gap-1 font-medium text-slate-700">
            <MapPin size={13} className="text-slate-400" />
            {facility.building_or_area}
          </span>
          {facility.opening_hours && (
            <span className="flex items-center gap-1">
              <Clock size={13} className="text-slate-400" />
              {facility.opening_hours}
            </span>
          )}
          {facility.distance_meters !== null && facility.distance_meters !== undefined && (
            <span className="text-teal-700 font-mono font-medium">
              ~{Math.round(facility.distance_meters)}m away (~{Math.max(1, Math.round(facility.distance_meters / 75))} min walk)
            </span>
          )}
        </div>

        {/* Specialized Laundry Card Highlight */}
        {isLaundry && (
          <div className="mb-3 p-2.5 bg-gradient-to-r from-teal-50/80 to-cyan-50/80 border border-teal-200/80 rounded-xl flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-slate-800">
              <Users size={14} className="text-teal-700 shrink-0" />
              <span>Crowd:</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                  derivedCrowd === 'Low'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : derivedCrowd === 'Medium'
                    ? 'bg-amber-100 text-amber-950 border-amber-300'
                    : derivedCrowd === 'High'
                    ? 'bg-rose-100 text-rose-900 border-rose-300'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {derivedCrowd ? `${derivedCrowd} Crowd` : 'No Recent Reports'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-teal-800 bg-white/80 border border-teal-200/60 px-2 py-0.5 rounded-md font-medium shrink-0">
              {crowdAssessment?.freshness || 'Decay: 2h'}
            </span>
          </div>
        )}

        {/* Recommendation Reason Rationale */}
        {facility.recommendation_reason && (
          <div className="bg-slate-50 border-l-2 border-teal-500 p-2.5 rounded text-xs text-slate-700 mb-3.5 leading-relaxed">
            {facility.recommendation_reason}
          </div>
        )}

        {/* Feature Reliability Breakdown */}
        {facility.feature_assessments && facility.feature_assessments.length > 0 && (
          <div className="mb-3">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Feature Statuses
            </div>
            <div className="flex flex-wrap gap-1.5">
              {facility.feature_assessments.map((feat) => {
                let badgeBg = 'bg-slate-100 text-slate-700';
                let Icon = HelpCircle;
                if (feat.status === 'LIKELY_WORKING') {
                  badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                  Icon = CheckCircle;
                } else if (feat.status === 'LIKELY_UNAVAILABLE') {
                  badgeBg = 'bg-rose-50 text-rose-800 border-rose-200';
                  Icon = XCircle;
                } else if (feat.status === 'CONFLICTING') {
                  badgeBg = 'bg-amber-50 text-amber-900 border-amber-200';
                  Icon = AlertTriangle;
                }

                return (
                  <span
                    key={feat.feature_id}
                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border font-medium ${badgeBg}`}
                    title={feat.explanation}
                  >
                    <Icon size={11} />
                    <span>{feat.display_name}: <strong>{feat.status.replace('LIKELY_', '').toLowerCase()}</strong></span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Freshness & Confidence Metrics */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <ConfidenceBadge
            label={facility.confidence_label}
            score={facility.confidence_score}
            size="sm"
          />
          <FreshnessBadge
            freshness={facility.freshness}
            lastReported={primaryAssessment?.last_reported_at}
            size="sm"
          />
        </div>
      </div>

      {/* Card Action Footer with accessible touch targets */}
      <div className="bg-slate-50/70 border-t border-slate-100 px-4 sm:px-5 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelect(facility.id)}
            type="button"
            className="text-xs font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1 py-2 px-1 focus-visible:ring-2 focus-visible:ring-teal-600 rounded cursor-pointer min-h-[44px]"
          >
            <span>Evidence & Timeline</span>
            <ArrowRight size={14} />
          </button>

          {facility.directions_url && (
            <a
              href={facility.directions_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-teal-700 hover:bg-slate-200/60 px-2 py-1.5 rounded transition-colors"
              title="Open Google Maps Walking Directions"
            >
              <Navigation size={12} className="text-teal-600" />
              <span className="hidden sm:inline">Directions</span>
            </a>
          )}
        </div>

        <button
          onClick={() => onReport(facility.id, primaryAssessment?.feature_id)}
          type="button"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-teal-700 hover:bg-white px-2.5 py-2 rounded border border-transparent hover:border-slate-200 transition-all cursor-pointer min-h-[44px]"
        >
          <PlusCircle size={13} />
          <span>Report Status</span>
        </button>
      </div>
    </div>
  );
};
