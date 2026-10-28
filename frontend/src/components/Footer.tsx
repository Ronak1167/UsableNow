import React from 'react';
import { ShieldCheck, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold text-lg text-white">UsableNow</span>
              <span className="text-xs bg-teal-900 text-teal-300 px-2 py-0.5 rounded font-mono">v1.0</span>
            </div>
            <p className="text-sm text-slate-400 mb-2">
              <strong>Open Doesn't Mean Usable.</strong> Know before you go.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              AI-assisted, need-aware facility usability platform engineered for students and hostel residents.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-teal-400" />
              Core Epistemic Principle
            </h4>
            <blockquote className="text-xs text-slate-300 bg-slate-800/80 p-3 rounded-md border-l-2 border-teal-500 leading-relaxed">
              <strong>UNKNOWN DOES NOT MEAN UNAVAILABLE.</strong><br />
              We never infer certainty from silence. Stale evidence decays, conflicting reports are highlighted, and unverified claims are never presented as established truth.
            </blockquote>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-2">Hackathon Project</h4>
            <p className="text-xs text-slate-400 mb-1">
              Built for <strong>Lumina '26 — Hack the Unseen</strong>
            </p>
            <p className="text-xs text-slate-400 mb-3">
              Team: <strong>404 Brain Not Found</strong><br />
              Pragya Ahlawat (Lead), Paras, Ronak Jain
            </p>
            <p className="text-[11px] text-slate-500 font-mono">
              Initial Deployment: JIIT Campus & Hostels
            </p>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 UsableNow. Demonstration platform for hackathon evaluation.</p>
          <div className="flex items-center gap-1 text-slate-400">
            <span>Crafted with care</span>
            <Heart size={14} className="text-rose-500 fill-rose-500 inline" />
            <span>by 404 Brain Not Found</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
