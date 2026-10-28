import React from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  PlusCircle,
  ShieldCheck,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Compass,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';

interface LandingPageProps {
  onOpenReportModal: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenReportModal }) => {
  const { data: sampleFacilities } = useQuery({
    queryKey: ['landing-preview-facilities'],
    queryFn: () => api.getFacilities({ status_filter: 'LIKELY_WORKING' }),
  });

  const previewFacility = sampleFacilities?.[0];

  return (
    <div className="space-y-16 sm:space-y-24 py-8 sm:py-16">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs sm:text-sm font-medium mb-6">
          <Sparkles size={15} className="text-teal-600" />
          <span>Lumina '26 Hackathon • Team 404 Brain Not Found</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-tight max-w-4xl mx-auto">
          Know before you go.{' '}
          <span className="block text-teal-700 font-extrabold mt-1">
            Open Doesn't Mean Usable.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Traditional campus maps tell you where a facility exists and whether the building is open.
          UsableNow answers what students actually need:
          <span className="block font-semibold text-slate-900 mt-2">
            "Which facility is most likely to meet my specific need right now, and how reliable is that information?"
          </span>
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <Link
            to="/discover"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-base shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Search size={18} />
            <span>Find a Facility</span>
          </Link>

          <button
            type="button"
            onClick={onOpenReportModal}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-base border border-slate-200 shadow-xs hover:shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <PlusCircle size={18} className="text-teal-600" />
            <span>Report an Update</span>
          </button>
        </div>

        {/* Core Principle Callout */}
        <div className="mt-12 max-w-3xl mx-auto bg-slate-900 text-slate-200 p-6 rounded-2xl shadow-xl text-left border border-slate-800">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck size={22} />
            </div>
            <div>
              <span className="text-xs uppercase font-mono tracking-wider text-teal-400 font-bold">
                Core Epistemic Safeguard
              </span>
              <h2 className="text-lg font-bold text-white mt-0.5">
                UNKNOWN DOES NOT MEAN UNAVAILABLE.
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
                If a water cooler has no reports for 24 hours, traditional apps assume it works, while lazy bots assume it's broken.
                UsableNow flags it honestly as <strong>UNKNOWN</strong> with decayed freshness, guiding students to corroboration rather than false certainty.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Realistic Product Preview Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">Live System Preview</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Real Evidence. Zero Guesswork.
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Inspect how the deterministic reliability engine scores facilities in real-time.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-lg p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
                  {previewFacility?.facility_type || 'Drinking Water Station'}
                </span>
                <span className="text-[10px] font-mono text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                  SEEDED DEMO RECORD
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                {previewFacility?.name || 'ABB-I Ground Floor RO Water Station'}
              </h3>
              <p className="text-xs text-slate-500">
                {previewFacility?.building_or_area || 'ABB-I Ground Floor near LH-1'} • Open 6:00 AM - 11:00 PM
              </p>
            </div>
            <StatusBadge status="LIKELY_WORKING" size="lg" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-6 border-b border-slate-100">
            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-xs text-slate-500 block mb-1">Status Calculation</span>
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Likely Working</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">3 independent agreeing observations</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-xs text-slate-500 block mb-1">Confidence Score</span>
              <div className="font-bold text-teal-700 text-sm flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-teal-600" />
                <span>High (88%)</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Exceeds 75% multi-source threshold</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl">
              <span className="text-xs text-slate-500 block mb-1">Evidence Freshness</span>
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Clock size={16} className="text-teal-600" />
                <span>Fresh (48m ago)</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Decay half-life: 6.0 hours</p>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-600 max-w-md">
              <strong>Engine Rationale:</strong> Cold RO Drinking Water Station confirmed working by student observations with no contradictory reports.
            </p>
            <Link
              to="/discover"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-teal-700 hover:text-teal-900"
            >
              <span>Explore all campus facilities & laundry</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">Engine Architecture</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Engineered for Campus Reality
          </h2>
          <p className="text-sm text-slate-500 max-w-xl mx-auto mt-2">
            Built from scratch to resolve real friction faced by students across lecture halls, labs, and hostels.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mb-4">
              <Compass size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Need-Aware Discovery</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Search by intent, such as <em>"I need drinking water near ABB-1"</em> or <em>"Find a working printer"</em>. Natural language parsing routes directly to validated feature categories.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center mb-4">
              <Clock size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Exponential Freshness Decay</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Evidence decays mathematically via <code>2^(-age / half_life)</code>. Highly variable utilities (water, toner) decay rapidly; physical accessibility ramps decay over 48 hours.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Conflict & Spam Protection</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              When reports disagree, UsableNow triggers a <strong>CONFLICTING</strong> warning. Duplicate spam bursts are dampened so a single user cannot fake community corroboration.
            </p>
          </div>
        </div>
      </section>

      {/* How it Works Walkthrough */}
      <section className="bg-slate-100/70 border-y border-slate-200/80 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">Simple Workflow</span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
              How UsableNow Works
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs relative">
              <span className="text-2xl font-black text-teal-600/30 font-mono mb-2 block">01</span>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Choose a Specific Need</h3>
              <p className="text-xs text-slate-600">
                Select water, printer, elevator, power socket, step-free ramp access, or campus laundry.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs relative">
              <span className="text-2xl font-black text-teal-600/30 font-mono mb-2 block">02</span>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Review Fresh Evidence</h3>
              <p className="text-xs text-slate-600">
                Inspect calculated confidence, report timestamps, and source notes before walking across campus.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs relative">
              <span className="text-2xl font-black text-teal-600/30 font-mono mb-2 block">03</span>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Compare Reliable Alternatives</h3>
              <p className="text-xs text-slate-600">
                If a preferred printer is jammed, instantly see the closest working backup facility.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs relative">
              <span className="text-2xl font-black text-teal-600/30 font-mono mb-2 block">04</span>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Submit Firsthand Updates</h3>
              <p className="text-xs text-slate-600">
                Take 5 seconds to log working or empty status, keeping the campus ecosystem accurate.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center pb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Ready to experience need-aware campus discovery?
        </h2>
        <p className="text-sm text-slate-600 mt-2 max-w-xl mx-auto">
          Explore the interactive dashboard, test natural-language search, and observe real-time status updates.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/discover"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-sm transition-colors cursor-pointer"
          >
            <span>Open Discovery Dashboard</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
};
