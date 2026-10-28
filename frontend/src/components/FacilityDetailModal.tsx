import React, { useEffect, useState } from 'react';
import {
  X,
  MapPin,
  Clock,
  PlusCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  History,
  Bot,
  Sparkles,
  Shield,
  ArrowRight,
  WashingMachine,
  Users,
  Timer,
  Navigation,
  ExternalLink,
  Compass
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, resolveApiUrl } from '../api/client';
import type { WalkingRoute } from '../types';
import { StatusBadge } from './StatusBadge';
import { ConfidenceBadge } from './ConfidenceBadge';
import { FreshnessBadge } from './FreshnessBadge';

interface FacilityDetailModalProps {
  facilityId: string | null;
  onClose: () => void;
  onReport: (facilityId: string, featureId?: string) => void;
  onSelectAlternative: (facilityId: string) => void;
}

export const FacilityDetailModal: React.FC<FacilityDetailModalProps> = ({
  facilityId,
  onClose,
  onReport,
  onSelectAlternative,
}) => {
  const { data: facility, isLoading, error } = useQuery({
    queryKey: ['facility', facilityId],
    queryFn: () => (facilityId ? api.getFacilityDetail(facilityId) : null),
    enabled: !!facilityId,
  });

  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [walkingRoute, setWalkingRoute] = useState<{ facilityId: string; route: WalkingRoute } | null>(null);
  const activeRoute = walkingRoute?.facilityId === facilityId ? walkingRoute.route : null;

  // Lock background scroll when modal is active
  useEffect(() => {
    if (facilityId) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [facilityId]);

  const handleCalculateRoute = async () => {
    if (!facility?.latitude || !facility?.longitude || !facilityId) return;
    setIsCalculatingRoute(true);
    try {
      // Campus center origin (JIIT Noida Sector 62 ABB-I central concourse: 28.62970, 77.37210)
      const res = await api.getWalkingRoute(28.62970, 77.37210, facility.latitude, facility.longitude);
      setWalkingRoute({ facilityId, route: res });
    } catch (err) {
      console.error('Failed to compute walking route', err);
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  if (!facilityId) return null;

  const isLaundry = Boolean(
    facility?.facility_type === 'Campus Laundry' ||
    facility?.features.some((f) => f.feature_type.includes('laundry'))
  );

  // Derive latest laundry metrics from recent reports
  const latestCrowdReport = facility?.recent_reports.find((r) => r.crowd_level);
  const latestStatusReport = facility?.recent_reports.find((r) => r.laundry_status);
  const latestTimeReport = facility?.recent_reports.find((r) => r.estimated_time);

  // Check feature assessment for crowd
  const crowdAssessment = facility?.feature_assessments.find((f) => f.feature_type === 'laundry_crowd');
  const machinesAssessment = facility?.feature_assessments.find((f) => f.feature_type === 'laundry_machines');

  const derivedCrowd = latestCrowdReport?.crowd_level || (
    crowdAssessment?.status === 'LIKELY_WORKING' ? 'Low' :
    crowdAssessment?.status === 'LIKELY_UNAVAILABLE' ? 'High' :
    crowdAssessment?.status === 'CONFLICTING' ? 'Conflicting' :
    null
  );

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="facility-detail-title"
    >
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-start justify-between bg-slate-50 shrink-0">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-teal-100 text-teal-800 flex items-center gap-1">
                {isLaundry && <WashingMachine size={12} />}
                <span>{facility?.facility_type || 'Facility'}</span>
              </span>
              {facility?.is_demo_data && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">
                  DEMO DATA
                </span>
              )}
            </div>
            <h2 id="facility-detail-title" className="text-lg sm:text-xl font-bold text-slate-900">
              {facility?.name || 'Loading facility...'}
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1 text-slate-700 font-medium">
                <MapPin size={13} className="text-slate-400" />
                {facility?.building_or_area}
              </span>
              {facility?.opening_hours && (
                <span className="flex items-center gap-1">
                  <Clock size={13} className="text-slate-400" />
                  {facility.opening_hours}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {isLoading && (
            <div className="py-12 text-center text-slate-500">
              <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">Evaluating reliability evidence from campus observations...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm">
              Failed to load facility details. Please check connection.
            </div>
          )}

          {facility && (
            <>
              {/* Specialized Laundry Live Usability Dashboard */}
              {isLaundry && (
                <div className="bg-gradient-to-br from-teal-50/90 via-cyan-50/60 to-slate-50 text-slate-900 rounded-2xl p-4 sm:p-5 shadow-xs border border-teal-200 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-200/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                        <WashingMachine size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-bold tracking-tight text-slate-900">
                          Laundry Usability Live Dashboard
                        </h3>
                        <p className="text-xs text-slate-500">
                          Decay-weighted crowds, cycle readiness & collection timestamps
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onReport(facility.id)}
                      className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer min-h-[36px]"
                    >
                      <PlusCircle size={14} />
                      <span>Quick Report</span>
                    </button>
                  </div>

                  {/* 3 Core Metric Cards — High Contrast & Easy to Scan */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 1. Crowd Level */}
                    <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <Users size={14} className="text-teal-600" />
                          <span>Crowd Level</span>
                        </span>
                        <span className="text-[10px] font-mono font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {crowdAssessment?.freshness || 'Decay: 2h'}
                        </span>
                      </div>
                      <div>
                        {derivedCrowd ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-extrabold px-2.5 py-1 rounded-md border ${
                                derivedCrowd === 'Low'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : derivedCrowd === 'Medium'
                                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                                  : 'bg-rose-50 text-rose-800 border-rose-300'
                              }`}
                            >
                              {derivedCrowd}
                            </span>
                            <span className="text-xs text-slate-600 font-medium">
                              {derivedCrowd === 'Low' ? 'Free machines' : derivedCrowd === 'Medium' ? 'Moderate wait' : 'Long queue'}
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic">
                            No recent reports
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 2. Collection & Readiness Status */}
                    <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <Clock size={14} className="text-teal-600" />
                          <span>Laundry Status</span>
                        </span>
                        <span className="text-[10px] font-mono font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          User-reported
                        </span>
                      </div>
                      <div>
                        {latestStatusReport?.laundry_status ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-extrabold px-2.5 py-1 rounded-md border ${
                                latestStatusReport.laundry_status === 'Ready'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : latestStatusReport.laundry_status === 'Delayed'
                                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                                  : latestStatusReport.laundry_status === 'Not ready'
                                  ? 'bg-sky-50 text-sky-800 border-sky-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              {latestStatusReport.laundry_status}
                            </span>
                            <span className="text-xs text-slate-600 font-medium">
                              {latestStatusReport.laundry_status === 'Ready' ? 'Available for pickup' :
                               latestStatusReport.laundry_status === 'Delayed' ? 'Cycle backlog' :
                               latestStatusReport.laundry_status === 'Not ready' ? 'Wash in progress' : 'Retrieved'}
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic">
                            No recent reports
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 3. Estimated Ready-by / Collection Time */}
                    <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <Timer size={14} className="text-teal-600" />
                          <span>Ready-By Estimate</span>
                        </span>
                        <span className="text-[10px] font-mono font-medium text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          Estimate
                        </span>
                      </div>
                      <div>
                        {latestTimeReport?.estimated_time ? (
                          <div>
                            <div className="text-sm font-bold text-slate-900 font-mono">
                              {latestTimeReport.estimated_time}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              User estimate • Not guaranteed
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic">
                            Unknown (No estimate)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Machine Status & Confidence Footer */}
                  <div className="pt-2 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2 border-t border-teal-200/80">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">Machines:</span>
                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800 font-semibold text-[11px]">
                        {machinesAssessment?.status === 'LIKELY_WORKING' ? 'Operational' :
                         machinesAssessment?.status === 'LIKELY_UNAVAILABLE' ? 'Out of order / Full' :
                         machinesAssessment?.status === 'CONFLICTING' ? 'Conflicting reports' : 'Unknown'}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="font-semibold text-slate-900">Confidence:</span>
                      <span className="text-teal-800 font-bold">
                        {machinesAssessment?.confidence_label || 'Unknown'} ({machinesAssessment?.confidence_score ?? 0}%)
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Decay: 2h crowd • 4h machines
                    </div>
                  </div>
                </div>
              )}

              {/* Description */}
              {facility.description && (
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 sm:p-3.5 rounded-lg border border-slate-100">
                  {facility.description}
                </p>
              )}

              {/* Feature Assessments Section */}
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Shield size={16} className="text-teal-600" />
                  <span>Feature Status & Evidence Analysis</span>
                </h3>

                <div className="space-y-4">
                  {facility.feature_assessments.map((feat) => (
                    <div
                      key={feat.feature_id}
                      className="border border-slate-200 rounded-xl p-3.5 sm:p-4 bg-white shadow-xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div>
                          <h4 className="font-semibold text-slate-900 text-sm sm:text-base">
                            {feat.display_name}
                          </h4>
                          <span className="text-xs text-slate-400 font-mono">
                            Type: {feat.feature_type}
                          </span>
                        </div>
                        <StatusBadge status={feat.status} size="sm" />
                      </div>

                      {/* Freshness & Confidence Metrics */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <ConfidenceBadge
                          label={feat.confidence_label}
                          score={feat.confidence_score}
                          size="sm"
                        />
                        <FreshnessBadge
                          freshness={feat.freshness}
                          lastReported={feat.last_reported_at}
                          size="sm"
                        />
                        <span className="text-xs text-slate-500 font-mono">
                          {feat.total_reports_count} report(s) ({feat.supporting_reports_count} agree, {feat.conflicting_reports_count} conflict)
                        </span>
                      </div>

                      {/* Natural Language Evidence Summary */}
                      {feat.summary_text && (
                        <div className="bg-teal-50/60 border border-teal-200/80 rounded-lg p-3 text-xs text-slate-800 mb-3">
                          <div className="flex items-center gap-1.5 font-semibold text-teal-900 mb-1">
                            {feat.summary_source?.includes('AI') ? (
                              <>
                                <Sparkles size={14} className="text-teal-600" />
                                <span>AI Evidence Summary ({feat.summary_source})</span>
                              </>
                            ) : (
                              <>
                                <Bot size={14} className="text-slate-600" />
                                <span>Grounded Reliability Summary ({feat.summary_source})</span>
                              </>
                            )}
                          </div>
                          <p className="leading-relaxed">{feat.summary_text}</p>
                        </div>
                      )}

                      {/* Conflict Callout */}
                      {feat.status === 'CONFLICTING' && (
                        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2 text-amber-900 text-xs mb-3">
                          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <strong>Conflicting Evidence Detected:</strong> Both working and unavailable reports were submitted recently. On-site verification is strongly advised before relying on this facility.
                          </div>
                        </div>
                      )}

                      {/* Inspect Evidence Breakdown Drawer */}
                      <details className="text-xs text-slate-500 cursor-pointer pt-1 border-t border-slate-100">
                        <summary className="font-medium text-teal-700 hover:text-teal-900 py-1">
                          Inspect Math & Weight Breakdown
                        </summary>
                        <div className="p-2.5 bg-slate-50 rounded mt-1 font-mono text-[11px] space-y-1 text-slate-700">
                          <div>Reason code: <span className="font-semibold">{feat.reason_code}</span></div>
                          <div>Effective working weight: {feat.evidence_breakdown.working_weight}</div>
                          <div>Effective unavailable weight: {feat.evidence_breakdown.unavailable_weight}</div>
                          <div>Feature half-life: {feat.evidence_breakdown.half_life_hours}h (decay = 2^(-age/half_life))</div>
                          <div>Last confirmed working: {feat.last_confirmed_working_at ? new Date(feat.last_confirmed_working_at).toLocaleString() : 'None in window'}</div>
                        </div>
                      </details>

                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => onReport(facility.id, feat.feature_id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800 hover:bg-teal-50 px-2.5 py-1.5 rounded transition-colors cursor-pointer min-h-[36px]"
                        >
                          <PlusCircle size={13} />
                          <span>Report for {feat.display_name}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Campus Location & Google Maps Navigation */}
              {facility.latitude && facility.longitude && (
                <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                        <Compass size={17} />
                      </div>
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                          Campus Location & Live Navigation
                        </h3>
                        <p className="text-xs text-slate-500">
                          {facility.building_or_area} • Sector 62, Noida Campus
                        </p>
                      </div>
                    </div>

                    {facility.directions_url && (
                      <a
                        href={facility.directions_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer min-h-[36px]"
                      >
                        <ExternalLink size={13} />
                        <span>Get Walking Directions</span>
                      </a>
                    )}
                  </div>

                  {/* Interactive / Static Google Maps Preview */}
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 w-full aspect-21/9 max-h-[220px]">
                    {facility.static_map_url ? (
                      <img
                        src={resolveApiUrl(facility.static_map_url)}
                        alt={`Campus map for ${facility.name}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          // Graceful fallback to hide broken image
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <iframe
                        title={`Map for ${facility.name}`}
                        src={`https://maps.google.com/maps?q=${facility.latitude},${facility.longitude}&z=17&output=embed`}
                        className="w-full h-full border-0"
                        loading="lazy"
                      />
                    )}
                    <div className="absolute bottom-2.5 left-2.5 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-md shadow-xs text-[11px] font-mono text-slate-700 flex items-center gap-1.5 border border-slate-200/70">
                      <MapPin size={12} className="text-teal-600" />
                      <span>{facility.latitude.toFixed(5)}, {facility.longitude.toFixed(5)}</span>
                      <span className="text-[10px] text-slate-400 font-sans">(Approximate Area)</span>
                    </div>
                  </div>

                  {/* Walking Route Computation via Google Routes */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs border-t border-slate-200/60">
                    <span className="text-slate-600">
                      Walking from campus center (ABB-I Central Atrium):
                    </span>
                    <button
                      type="button"
                      onClick={handleCalculateRoute}
                      disabled={isCalculatingRoute}
                      className="text-teal-700 hover:text-teal-900 font-semibold inline-flex items-center gap-1.5 cursor-pointer py-1"
                    >
                      {isCalculatingRoute ? (
                        <span className="flex items-center gap-1 text-slate-500">
                          <span className="w-3 h-3 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                          <span>Routing with Google Maps...</span>
                        </span>
                      ) : activeRoute ? (
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 ${
                          activeRoute.source === 'google_routes_api'
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}>
                          <Navigation size={12} className={activeRoute.source === 'google_routes_api' ? 'text-emerald-700' : 'text-slate-500'} />
                          <span>
                            {activeRoute.duration_formatted} ({activeRoute.distance_meters}m) • {activeRoute.source === 'google_routes_api' ? 'Google Routes (Live)' : 'Geometric Walk (Fallback)'}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-teal-700 hover:underline">
                          <Navigation size={13} />
                          <span>Calculate Walking Time</span>
                        </span>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Note: Coordinates indicate building footprint entrance. Room-level indoor walk times may vary by floor and staircase availability.
                  </p>
                </div>
              )}

              {/* Chronological Observation Timeline */}
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <History size={16} className="text-teal-600" />
                  <span>Observation History & Timeline</span>
                </h3>

                {facility.recent_reports.length === 0 ? (
                  <p className="text-xs text-slate-500 italic bg-slate-50 p-4 rounded-lg text-center">
                    No individual reports logged yet. Be the first to report!
                  </p>
                ) : (
                  <div className="space-y-3 border-l-2 border-slate-200 ml-2 pl-3 sm:pl-4">
                    {facility.recent_reports.map((rep) => {
                      let StatusIcon = HelpCircle;
                      let badgeColor = 'text-slate-700 bg-slate-100';
                      if (rep.reported_status === 'WORKING') {
                        StatusIcon = CheckCircle;
                        badgeColor = 'text-emerald-800 bg-emerald-50 border border-emerald-200';
                      } else if (rep.reported_status === 'UNAVAILABLE') {
                        StatusIcon = XCircle;
                        badgeColor = 'text-rose-800 bg-rose-50 border border-rose-200';
                      } else if (rep.reported_status === 'UNCERTAIN') {
                        StatusIcon = AlertTriangle;
                        badgeColor = 'text-amber-800 bg-amber-50 border border-amber-200';
                      }

                      return (
                        <div key={rep.id} className="relative text-xs">
                          <span className="absolute -left-[19px] sm:-left-[21px] top-1.5 w-2 h-2 rounded-full bg-teal-600 ring-4 ring-white" />
                          <div className="bg-slate-50 border border-slate-200/80 p-3 sm:p-3.5 rounded-lg space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded text-[11px] ${badgeColor}`}>
                                <StatusIcon size={12} />
                                <span>{rep.reported_status}</span>
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                {new Date(rep.created_at).toLocaleString()}
                              </span>
                            </div>

                            {/* Laundry Specific Tags */}
                            {(rep.crowd_level || rep.laundry_status || rep.estimated_time) && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {rep.crowd_level && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-100 text-cyan-900 font-semibold text-[10px]">
                                    <Users size={10} />
                                    <span>Crowd: {rep.crowd_level}</span>
                                  </span>
                                )}
                                {rep.laundry_status && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 font-semibold text-[10px]">
                                    <Clock size={10} />
                                    <span>Status: {rep.laundry_status}</span>
                                  </span>
                                )}
                                {rep.estimated_time && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px]">
                                    <Timer size={10} />
                                    <span>Estimate: {rep.estimated_time}</span>
                                  </span>
                                )}
                              </div>
                            )}

                            {rep.note && (
                              <p className="text-slate-700 mt-1 italic">"{rep.note}"</p>
                            )}

                            <div className="mt-2 text-[10px] text-slate-400 flex flex-wrap gap-2 pt-1 border-t border-slate-200/60">
                              <span>Source: <strong className="text-slate-600">{rep.source_type.replace('_', ' ')}</strong></span>
                              <span>(Unverified student declaration)</span>
                              {rep.is_demo_data && <span className="text-amber-700 font-mono">[Seed Demo]</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Matching Alternatives */}
              {facility.alternatives && facility.alternatives.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">
                    Nearby Campus Alternatives
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {facility.alternatives.map((alt) => (
                      <div
                        key={alt.id}
                        onClick={() => onSelectAlternative(alt.id)}
                        className="p-3 border border-slate-200 rounded-lg hover:border-teal-500 hover:bg-teal-50/20 cursor-pointer transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-semibold text-xs text-slate-900 truncate">
                              {alt.name}
                            </span>
                            <StatusBadge status={alt.primary_status} size="sm" />
                          </div>
                          <span className="text-[11px] text-slate-500 flex items-center gap-1">
                            <MapPin size={11} /> {alt.building_or_area}
                          </span>
                        </div>
                        <span className="mt-2 text-[11px] text-teal-700 font-semibold flex items-center gap-1">
                          <span>Inspect this alternative</span>
                          <ArrowRight size={12} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer min-h-[44px] flex items-center"
          >
            Close
          </button>

          <button
            type="button"
            onClick={() => onReport(facilityId)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer min-h-[44px]"
          >
            <PlusCircle size={14} />
            <span>Submit Update</span>
          </button>
        </div>
      </div>
    </div>
  );
};
