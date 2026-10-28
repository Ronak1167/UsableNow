import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, PlusCircle, Shield, FileText, CheckCircle2, Search, Home } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

interface NavbarProps {
  onOpenReportModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenReportModal }) => {
  const location = useLocation();

  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 30000,
  });

  const isConnected = health?.status === 'healthy';

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          {/* Brand — Always fully visible and unclipped */}
          <Link
            to="/"
            className="flex items-center gap-2.5 group focus-visible:ring-2 focus-visible:ring-teal-600 rounded-lg p-1 min-h-[44px] shrink-0"
            aria-label="UsableNow Home"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-xs group-hover:bg-teal-700 transition-colors relative shrink-0">
              <MapPin size={20} className="relative z-10" />
              <span className="absolute -bottom-1 -right-1 bg-white text-teal-700 rounded-full p-0.5 shadow-xs">
                <CheckCircle2 size={11} />
              </span>
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight whitespace-nowrap">
                  UsableNow
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200/80 rounded-md shrink-0">
                  JIIT
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium leading-tight hidden sm:block whitespace-nowrap">
                Open Doesn't Mean Usable
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
            <Link
              to="/discover"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                location.pathname === '/discover'
                  ? 'bg-slate-100 text-teal-800 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Find Facilities
            </Link>
            <Link
              to="/methodology"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                location.pathname === '/methodology'
                  ? 'bg-slate-100 text-teal-800 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <FileText size={16} />
              <span>Methodology</span>
            </Link>
            <Link
              to="/admin"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                location.pathname === '/admin'
                  ? 'bg-slate-100 text-teal-800 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Shield size={16} />
              <span>Admin</span>
            </Link>
          </nav>

          {/* Actions & Health */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-mono bg-slate-100 text-slate-600 border border-slate-200"
              title={isConnected ? 'Backend API connected' : 'Backend offline or reconnecting'}
            >
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="hidden sm:inline">{isConnected ? 'API Live' : 'Offline'}</span>
            </div>

            <button
              onClick={onOpenReportModal}
              type="button"
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all focus-visible:ring-2 focus-visible:ring-teal-600 cursor-pointer min-h-[40px] sm:min-h-[44px]"
              aria-label="Share an observation"
            >
              <PlusCircle size={15} />
              <span>Report</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile-First Bottom Navigation Bar (Visible on phone/tablet < 768px) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-lg px-2 py-1.5 flex items-center justify-around"
        aria-label="Mobile Navigation Bar"
      >
        <Link
          to="/"
          className={`flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-medium min-h-[44px] min-w-[54px] ${
            location.pathname === '/' ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home size={18} />
          <span>Home</span>
        </Link>

        <Link
          to="/discover"
          className={`flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-medium min-h-[44px] min-w-[54px] ${
            location.pathname === '/discover' ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Search size={18} />
          <span>Find</span>
        </Link>

        {/* Center Quick Report Action */}
        <button
          type="button"
          onClick={onOpenReportModal}
          className="flex flex-col items-center justify-center -mt-3.5 bg-teal-600 hover:bg-teal-700 text-white p-2.5 rounded-full shadow-md active:scale-95 transition-transform min-h-[48px] min-w-[48px] cursor-pointer"
          aria-label="Quick report status"
        >
          <PlusCircle size={22} />
        </button>

        <Link
          to="/methodology"
          className={`flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-medium min-h-[44px] min-w-[54px] ${
            location.pathname === '/methodology' ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText size={18} />
          <span>Rules</span>
        </Link>

        <Link
          to="/admin"
          className={`flex flex-col items-center justify-center p-1.5 rounded-lg text-[10px] font-medium min-h-[44px] min-w-[54px] ${
            location.pathname === '/admin' ? 'text-teal-700 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Shield size={18} />
          <span>Admin</span>
        </Link>
      </nav>
    </>
  );
};
