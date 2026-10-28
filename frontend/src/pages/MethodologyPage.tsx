import React from 'react';
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  Bot,
  Database,
  Scale
} from 'lucide-react';

export const MethodologyPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 sm:space-y-12">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
          <Scale size={14} />
          <span>Epistemic Transparency & Open Mathematics</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Reliability Engine Methodology
        </h1>
        <p className="text-xs sm:text-base text-slate-600 max-w-2xl mx-auto">
          How UsableNow evaluates campus observations, computes evidence decay, and guarantees that unknown is never mistaken for unavailable.
        </p>
      </div>

      {/* 1. Core Principle */}
      <section className="bg-slate-900 text-slate-200 rounded-2xl p-4 sm:p-8 shadow-xl border border-slate-800 space-y-4">
        <div className="flex items-start sm:items-center gap-3 text-teal-400">
          <ShieldCheck size={26} className="shrink-0 mt-0.5 sm:mt-0" />
          <h2 className="text-lg sm:text-xl font-bold text-white leading-snug">Rule 1: UNKNOWN DOES NOT MEAN UNAVAILABLE</h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          In typical crowd-sourced applications, absence of evidence is frequently treated as negative evidence.
          If nobody has reported on a water cooler for two days, naive systems often infer that it has broken down or stopped functioning.
        </p>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          At UsableNow, we enforce strict epistemic modesty: <strong>Silence is simply unknown.</strong> If observations decay beyond active decision thresholds, the status safely transitions to <code>UNKNOWN</code>. This informs students to check or report, rather than falsely telling them a working dispenser is dead.
        </p>
      </section>

      {/* 2. Exponential Freshness Decay */}
      <section className="bg-white rounded-2xl p-4 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-3 text-teal-700">
          <Clock size={24} className="shrink-0" />
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">Configurable Exponential Decay</h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          Reports lose evidential value over time following an exponential decay curve:
        </p>
        
        <div className="bg-slate-50 border border-slate-200 p-3 sm:p-4 rounded-xl font-mono text-center text-xs sm:text-base text-slate-900 overflow-x-auto">
          <code className="inline-block break-all sm:break-normal">freshness_weight = 2 ^ (-age_hours / half_life_hours)</code>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          Because different physical amenities have fundamentally different failure rates, our engine configures custom half-lives:
        </p>

        <div className="overflow-x-auto -mx-1 sm:mx-0 border border-slate-200 rounded-lg">
          <table className="min-w-full text-xs text-left divide-y divide-slate-200">
            <thead className="bg-slate-100 text-slate-700 font-semibold uppercase">
              <tr>
                <th className="p-2.5 sm:p-3 whitespace-nowrap">Feature Category</th>
                <th className="p-2.5 sm:p-3 whitespace-nowrap">Half-Life ($t_{1/2}$)</th>
                <th className="p-2.5 sm:p-3 min-w-[180px]">Engineering Justification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              <tr>
                <td className="p-2.5 sm:p-3 font-semibold text-slate-900 whitespace-nowrap">Drinking Water Station</td>
                <td className="p-2.5 sm:p-3 font-mono text-teal-700 font-bold whitespace-nowrap">6.0 Hours</td>
                <td className="p-2.5 sm:p-3">Water chillers and RO filters can deplete or suffer filter cut-offs within a single class change cycle.</td>
              </tr>
              <tr>
                <td className="p-2.5 sm:p-3 font-semibold text-slate-900 whitespace-nowrap">Printers & Scanners</td>
                <td className="p-2.5 sm:p-3 font-mono text-teal-700 font-bold whitespace-nowrap">6.0 Hours</td>
                <td className="p-2.5 sm:p-3">Toner and paper trays deplete rapidly during project submission periods.</td>
              </tr>
              <tr>
                <td className="p-2.5 sm:p-3 font-semibold text-slate-900 whitespace-nowrap">Charging Sockets & Wi-Fi</td>
                <td className="p-2.5 sm:p-3 font-mono text-teal-700 font-bold whitespace-nowrap">6.0 - 8.0 Hours</td>
                <td className="p-2.5 sm:p-3">Circuit breakers and access points fluctuate with campus power and load changes.</td>
              </tr>
              <tr>
                <td className="p-2.5 sm:p-3 font-semibold text-slate-900 whitespace-nowrap">Passenger Lifts & Elevators</td>
                <td className="p-2.5 sm:p-3 font-mono text-teal-700 font-bold whitespace-nowrap">24.0 Hours</td>
                <td className="p-2.5 sm:p-3">Mechanical elevators remain in maintenance or operational state longer.</td>
              </tr>
              <tr>
                <td className="p-2.5 sm:p-3 font-semibold text-slate-900 whitespace-nowrap">Campus Laundry Crowd</td>
                <td className="p-2.5 sm:p-3 font-mono text-teal-700 font-bold whitespace-nowrap">2.0 Hours</td>
                <td className="p-2.5 sm:p-3">Crowds and machine queues fluctuate rapidly cycle-by-cycle (~35-45 mins).</td>
              </tr>
              <tr>
                <td className="p-2.5 sm:p-3 font-semibold text-slate-900 whitespace-nowrap">Laundry Washers & Dryers</td>
                <td className="p-2.5 sm:p-3 font-mono text-teal-700 font-bold whitespace-nowrap">4.0 Hours</td>
                <td className="p-2.5 sm:p-3">Washer/dryer operational status and mechanical breakdowns typically resolve within hours.</td>
              </tr>
              <tr>
                <td className="p-2.5 sm:p-3 font-semibold text-slate-900 whitespace-nowrap">Step-Free Ramps & Entrances</td>
                <td className="p-2.5 sm:p-3 font-mono text-teal-700 font-bold whitespace-nowrap">48.0 Hours</td>
                <td className="p-2.5 sm:p-3">Physical architectural ramps rarely vanish; blockages are occasional maintenance events.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Anti-Spam & Corroboration Safeguards */}
      <section className="bg-white rounded-2xl p-4 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-3 text-teal-700">
          <AlertTriangle size={24} className="shrink-0" />
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">Safeguards Against Overconfidence & Spam</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
            <h4 className="font-bold text-slate-900 text-sm">Single-Report Ceiling</h4>
            <p>
              A single isolated report, no matter how recent, is mathematically capped at <strong>Medium Confidence (max 60%)</strong>. High confidence strictly requires multiple independent observations.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
            <h4 className="font-bold text-slate-900 text-sm">Cluster & Burst Dampening</h4>
            <p>
              Successive duplicate clicks from the same client IP or within 10 minutes are dampened to <code>weight * 0.2</code>, preventing artificial inflation of consensus.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
            <h4 className="font-bold text-slate-900 text-sm">Conflict Threshold</h4>
            <p>
              If both working and unavailable have fresh weight with a conflict ratio ≥ 25%, the engine forces <code>CONFLICTING</code> rather than picking a majority winner.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
            <h4 className="font-bold text-slate-900 text-sm">Unauthenticated Source Grounding</h4>
            <p>
              Selecting "Maintenance Staff" on a public submission is recorded as a self-label only. It never grants automated administrative trust without cryptographic verification.
            </p>
          </div>
        </div>
      </section>

      {/* 4. AI Interpretation vs Deterministic Fallback */}
      <section className="bg-white rounded-2xl p-4 sm:p-8 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-3 text-teal-700">
          <Bot size={24} className="shrink-0" />
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">AI Role & Graceful Degradation</h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          AI functions exclusively as an <strong>interpretation layer</strong>, never as an empirical authority.
        </p>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-700">
          <div className="font-semibold text-slate-900">What AI Is Allowed To Do:</div>
          <ul className="list-disc list-inside space-y-1 text-slate-600">
            <li>Parse natural-language student queries (e.g. <em>"where can I print color slides"</em>) into structured filters.</li>
            <li>Draft concise, grounded summaries directly referencing actual logged timestamps and notes.</li>
          </ul>

          <div className="font-semibold text-slate-900 pt-2">What AI Is Strictly Forbidden From Doing:</div>
          <ul className="list-disc list-inside space-y-1 text-rose-700">
            <li>Never invents reports, observations, or campus timestamps.</li>
            <li>Never overrides the mathematical status computed by the reliability engine.</li>
            <li>Never converts an UNKNOWN state into a fabricated WORKING or UNAVAILABLE state.</li>
          </ul>
        </div>

        <p className="text-xs text-slate-500">
          If no Gemini or OpenAI key is configured, our zero-dependency <strong>deterministic regex/pattern fallback</strong> activates seamlessly without degradation of core functionality. Every summary visibly discloses its origin.
        </p>
      </section>

      {/* 5. Demonstration Data Notice */}
      <section className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 sm:p-8 space-y-3">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-base">
          <Database size={20} className="text-amber-700 shrink-0" />
          <span>Lumina '26 Demonstration Data Disclosure</span>
        </div>
        <p className="text-xs text-amber-900 leading-relaxed">
          To demonstrate all edge cases (multi-source agreement, single-report caps, conflict alerts, decaying stale evidence, and silent unknown states), 17 illustrative facilities across JIIT Sector 62 / 128 campus areas are seeded in the default database.
        </p>
        <p className="text-xs text-amber-800">
          Every seeded record is flagged with <code>is_demo_data: true</code>. Campus teams can reset or replace the dataset with live on-site physical audits at any time via the Admin interface.
        </p>
      </section>
    </div>
  );
};
