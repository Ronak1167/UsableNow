import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, Send, WashingMachine, Users, Clock, Sparkles } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import type { ReportedStatus, SourceType } from '../types';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedFacilityId?: string;
  preselectedFeatureId?: string;
  onSuccess?: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  preselectedFacilityId,
  preselectedFeatureId,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const [facilityId, setFacilityId] = useState<string>(preselectedFacilityId || '');
  const [featureId, setFeatureId] = useState<string>(preselectedFeatureId || '');
  const [reportedStatus, setReportedStatus] = useState<ReportedStatus>('WORKING');
  const [sourceType, setSourceType] = useState<SourceType>('STUDENT_REPORT');
  const [note, setNote] = useState<string>('');
  const [evidenceUrl, setEvidenceUrl] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Laundry specific state
  const [crowdLevel, setCrowdLevel] = useState<'Low' | 'Medium' | 'High' | ''>('');
  const [laundryStatus, setLaundryStatus] = useState<'Ready' | 'Delayed' | 'Not ready' | 'Collected' | ''>('');
  const [estimatedTime, setEstimatedTime] = useState<string>('');

  // Load facilities for dropdown
  const { data: facilities } = useQuery({
    queryKey: ['facilities-list'],
    queryFn: () => api.getFacilities(),
    enabled: isOpen,
  });

  // Lock background scroll when modal is active
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  // Current selected facility and its features
  const selectedFacility = facilities?.find((f) => f.id === facilityId);
  const effectiveFeatureId = featureId || (selectedFacility && selectedFacility.features.length > 0 ? selectedFacility.features[0].id : '');

  const isLaundry = Boolean(
    selectedFacility?.facility_type === 'Campus Laundry' ||
    selectedFacility?.features.some((f) => f.feature_type.includes('laundry')) ||
    effectiveFeatureId.includes('laundry')
  );

  const reportMutation = useMutation({
    mutationFn: api.submitReport,
    onSuccess: () => {
      // Invalidate relevant queries so live UI refreshes immediately
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      queryClient.invalidateQueries({ queryKey: ['facility', facilityId] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['search'] });
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });

      setSuccessMessage('Observation submitted for review! Once verified by moderation, it will update campus availability and report history.');
      setFormError(null);
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
        if (onSuccess) onSuccess();
      }, 1800);
    },
    onError: (err: any) => {
      let msg = err instanceof ApiError ? err.message : 'Failed to submit report. Please check inputs.';
      if (err instanceof ApiError && err.status === 429) {
        msg = err.message || 'Observation already logged moments ago. Duplicate protection is active; please wait a moment before submitting another update.';
      }
      setFormError(msg);
      setSuccessMessage(null);
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const targetFacilityId = facilityId;
    const targetFeatureId = featureId || effectiveFeatureId;

    if (!targetFacilityId) {
      setFormError('Please select a facility.');
      return;
    }
    if (!targetFeatureId) {
      setFormError('Please select a specific feature.');
      return;
    }

    reportMutation.mutate({
      facility_id: targetFacilityId,
      feature_id: targetFeatureId,
      reported_status: reportedStatus,
      source_type: sourceType,
      note: note.trim() || undefined,
      evidence_url: evidenceUrl.trim() || undefined,
      is_anonymous: isAnonymous,
      crowd_level: crowdLevel || undefined,
      laundry_status: laundryStatus || undefined,
      estimated_time: estimatedTime.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 id="report-modal-title" className="text-base sm:text-lg font-bold text-slate-900">
                {isLaundry ? 'Share Laundry Observation' : 'Share an Observation'}
              </h2>
              {isLaundry && (
                <span className="text-[10px] font-semibold bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <WashingMachine size={11} />
                  <span>Laundry Mode</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">Share firsthand evidence to help fellow students know what is usable right now.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800 text-xs sm:text-sm">
              <CheckCircle size={18} className="shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-800 text-xs sm:text-sm">
              <AlertCircle size={18} className="shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* Facility Selection */}
          <div>
            <label htmlFor="facility-select" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Campus Facility *
            </label>
            <select
              id="facility-select"
              value={facilityId}
              onChange={(e) => {
                const nextFacId = e.target.value;
                setFacilityId(nextFacId);
                const nextFac = facilities?.find((f) => f.id === nextFacId);
                setFeatureId(nextFac?.features[0]?.id || '');
              }}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors min-h-[44px]"
              required
            >
              <option value="">-- Choose Facility --</option>
              {facilities?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.building_or_area})
                </option>
              ))}
            </select>
          </div>

          {/* Feature Selection */}
          <div>
            <label htmlFor="feature-select" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Feature to Report *
            </label>
            <select
              id="feature-select"
              value={effectiveFeatureId}
              onChange={(e) => setFeatureId(e.target.value)}
              disabled={!selectedFacility || selectedFacility.features.length === 0}
              className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors disabled:bg-slate-100 disabled:text-slate-400 min-h-[44px]"
              required
            >
              {!selectedFacility && <option value="">Select a facility first</option>}
              {selectedFacility?.features.map((feat) => (
                <option key={feat.id} value={feat.id}>
                  {feat.display_name} ({feat.feature_type})
                </option>
              ))}
            </select>
          </div>

          {/* Specialized Laundry Quick Reporting Section */}
          {isLaundry && (
            <div className="bg-cyan-50/70 border border-cyan-200 rounded-xl p-3.5 space-y-3.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-950 uppercase tracking-wide">
                <Sparkles size={14} className="text-cyan-700" />
                <span>Laundry Quick Usability Metrics</span>
              </div>

              {/* 1. Crowd Level */}
              <div>
                <label className="block text-[11px] font-semibold text-cyan-900 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    <span>Crowd Level (Wait / Busyness)</span>
                  </span>
                  {crowdLevel && <span className="text-cyan-700 font-bold">{crowdLevel}</span>}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Low', 'Medium', 'High'] as const).map((lvl) => {
                    const isSelected = crowdLevel === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => {
                          setCrowdLevel(isSelected ? '' : lvl);
                          if (lvl === 'Low') setReportedStatus('WORKING');
                          else if (lvl === 'Medium') setReportedStatus('UNCERTAIN');
                          else if (lvl === 'High') setReportedStatus('UNAVAILABLE');
                        }}
                        className={`py-2 px-2 rounded-lg text-xs font-semibold border flex flex-col items-center justify-center transition-all min-h-[44px] cursor-pointer ${
                          isSelected
                            ? lvl === 'Low'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-200'
                              : lvl === 'Medium'
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-200'
                              : 'bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-200'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span>{lvl}</span>
                        <span className={`text-[10px] font-normal ${isSelected ? 'text-white/90' : 'text-slate-500'}`}>
                          {lvl === 'Low' ? 'Free machines' : lvl === 'Medium' ? 'Short queue' : 'Packed / wait'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Laundry Status */}
              <div>
                <label className="block text-[11px] font-semibold text-cyan-900 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>Readiness / Cycle Status</span>
                  </span>
                  {laundryStatus && <span className="text-cyan-700 font-bold">{laundryStatus}</span>}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(['Ready', 'Delayed', 'Not ready', 'Collected'] as const).map((st) => {
                    const isSelected = laundryStatus === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setLaundryStatus(isSelected ? '' : st)}
                        className={`py-2 px-2 rounded-lg text-xs font-medium border text-center transition-all min-h-[44px] cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-800 text-white border-cyan-800 shadow-xs font-semibold'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Estimated Collection / Ready-by Time */}
              <div>
                <label htmlFor="est-time" className="block text-[11px] font-semibold text-cyan-900 mb-1">
                  Estimated Collection / Ready-by Time (User-reported estimate)
                </label>
                <input
                  type="text"
                  id="est-time"
                  value={estimatedTime}
                  onChange={(e) => setEstimatedTime(e.target.value)}
                  placeholder="e.g. Ready in 30 mins, or pickup by 5:30 PM"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-cyan-300 bg-white text-slate-800 focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 min-h-[40px]"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {['Ready now', 'In ~30 mins', 'In ~45 mins', 'Pickup ~6:00 PM', 'Delayed ~20m'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEstimatedTime(preset)}
                      className="text-[10px] bg-white border border-cyan-300 text-cyan-900 px-2 py-0.5 rounded hover:bg-cyan-100 transition-colors cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Overall Status Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Overall Observed Usability Condition *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setReportedStatus('WORKING')}
                className={`py-2.5 px-2 rounded-lg text-xs sm:text-sm font-semibold border flex flex-col items-center gap-1 transition-all min-h-[48px] cursor-pointer ${
                  reportedStatus === 'WORKING'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-200'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>Working</span>
                <span className="text-[10px] font-normal text-emerald-700">Usable / free</span>
              </button>

              <button
                type="button"
                onClick={() => setReportedStatus('UNAVAILABLE')}
                className={`py-2.5 px-2 rounded-lg text-xs sm:text-sm font-semibold border flex flex-col items-center gap-1 transition-all min-h-[48px] cursor-pointer ${
                  reportedStatus === 'UNAVAILABLE'
                    ? 'bg-rose-50 border-rose-500 text-rose-800 ring-2 ring-rose-200'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>Unavailable</span>
                <span className="text-[10px] font-normal text-rose-700">Broken / full</span>
              </button>

              <button
                type="button"
                onClick={() => setReportedStatus('UNCERTAIN')}
                className={`py-2.5 px-2 rounded-lg text-xs sm:text-sm font-semibold border flex flex-col items-center gap-1 transition-all min-h-[48px] cursor-pointer ${
                  reportedStatus === 'UNCERTAIN'
                    ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-200'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>Uncertain</span>
                <span className="text-[10px] font-normal text-amber-700">Partial / wait</span>
              </button>
            </div>
          </div>

          {/* Source Type */}
          <div>
            <label htmlFor="source-type" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Observation Basis
            </label>
            <select
              id="source-type"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as SourceType)}
              className="w-full px-3 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 min-h-[44px]"
            >
              <option value="STUDENT_REPORT">Student Report (Observed personally)</option>
              <option value="ON_SITE_OBSERVATION">On-site Physical Check (Verified right now)</option>
              <option value="MAINTENANCE_STAFF">Campus Staff / Operator (Unverified self-tag)</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <Info size={12} />
              <span>Selecting 'Staff' describes self-declaration; it is not verified administrative access.</span>
            </p>
          </div>

          {/* Note */}
          <div>
            <label htmlFor="report-note" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Observation Notes (Optional)
            </label>
            <textarea
              id="report-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isLaundry ? "e.g. Washers 1-3 free, dryer 2 is noisy, cycle takes 40 mins." : "e.g. Water is cold and flowing normally, or jammed paper tray 2."}
              rows={2}
              maxLength={500}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Evidence URL */}
          <div>
            <label htmlFor="evidence-url" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Evidence Reference / Photo Link (Optional)
            </label>
            <input
              type="url"
              id="evidence-url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500 font-mono min-h-[40px]"
            />
          </div>

          {/* Anonymous toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="anon-checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
            />
            <label htmlFor="anon-checkbox" className="text-xs text-slate-600 cursor-pointer select-none">
              Submit anonymously (no personal account identifiers logged)
            </label>
          </div>

          {/* Submit button */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm text-slate-600 hover:text-slate-900 font-medium min-h-[44px] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={reportMutation.isPending}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              <Send size={15} />
              <span>{reportMutation.isPending ? 'Sharing...' : 'Share Observation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
