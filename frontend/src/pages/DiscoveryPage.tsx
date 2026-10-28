import React, { useState, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  Sparkles,
  Droplets,
  Printer,
  ChevronRight,
  Accessibility,
  BatteryCharging,
  BookOpen,
  Wifi,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  X,
  WashingMachine,
  MapPin,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { FacilityCard } from '../components/FacilityCard';
import { FacilityDetailModal } from '../components/FacilityDetailModal';

const QUICK_NEEDS = [
  { id: 'drinking_water', label: 'Drinking Water', icon: Droplets, color: 'text-sky-600' },
  { id: 'printer', label: 'Working Printer', icon: Printer, color: 'text-indigo-600' },
  { id: 'lift', label: 'Functional Lift', icon: ChevronRight, color: 'text-amber-600' },
  { id: 'step_free_access', label: 'Step-Free Ramp', icon: Accessibility, color: 'text-emerald-600' },
  { id: 'accessible_washroom', label: 'Accessible Washroom', icon: Accessibility, color: 'text-teal-600' },
  { id: 'charging_point', label: 'Charging Point', icon: BatteryCharging, color: 'text-purple-600' },
  { id: 'study_space', label: 'Quiet Study Space', icon: BookOpen, color: 'text-rose-600' },
  { id: 'wifi', label: 'Campus Wi-Fi', icon: Wifi, color: 'text-blue-600' },
  { id: 'laundry_machines', label: 'Laundry Machines', icon: WashingMachine, color: 'text-cyan-600' },
];

interface DiscoveryPageProps {
  onOpenReportModal: (facilityId?: string, featureId?: string) => void;
}

export const DiscoveryPage: React.FC<DiscoveryPageProps> = ({ onOpenReportModal }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selectedNeed, setSelectedNeed] = useState<string | null>(null);
  const [buildingFilter, setBuildingFilter] = useState('');
  const [facilityTypeFilter, setFacilityTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [freshnessFilter, setFreshnessFilter] = useState('');
  const [sortBy, setSortBy] = useState<'best_match' | 'freshness' | 'name' | 'proximity'>('best_match');
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Modal inspection
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);

  // Load facilities with real backend filtering and location-aware distance ranking
  const {
    data: facilities,
    isLoading,
    isRefetching,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['facilities', selectedNeed, buildingFilter, facilityTypeFilter, statusFilter, freshnessFilter, userLocation?.lat, userLocation?.lon],
    queryFn: () =>
      api.getFacilities({
        feature_type: selectedNeed || undefined,
        building: buildingFilter || undefined,
        facility_type: facilityTypeFilter || undefined,
        status_filter: statusFilter || undefined,
        freshness_filter: freshnessFilter || undefined,
        user_lat: userLocation?.lat,
        user_lon: userLocation?.lon,
      }),
  });

  const handleToggleLocation = () => {
    if (userLocation) {
      setUserLocation(null);
      if (sortBy === 'proximity') setSortBy('best_match');
      return;
    }

    setIsLocating(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            label: 'My GPS Location'
          });
          setSortBy('proximity');
          setIsLocating(false);
        },
        () => {
          // Fallback to JIIT Noida Sector 62 central concourse (ABB-I Atrium)
          setUserLocation({
            lat: 28.62970,
            lon: 77.37210,
            label: 'Campus Center (ABB-I)'
          });
          setSortBy('proximity');
          setIsLocating(false);
        },
        { timeout: 3500 }
      );
    } else {
      setUserLocation({
        lat: 28.62970,
        lon: 77.37210,
        label: 'Campus Center (ABB-I)'
      });
      setSortBy('proximity');
      setIsLocating(false);
    }
  };

  // Natural Language Search Query
  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ['search', activeSearch],
    queryFn: () => (activeSearch ? api.searchFacilities(activeSearch) : null),
    enabled: !!activeSearch,
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setActiveSearch(searchQuery.trim());
    } else {
      setActiveSearch('');
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setActiveSearch('');
  };

  // Determine active display list
  const displayFacilities = useMemo(() => {
    let list = activeSearch && searchResults?.results ? searchResults.results : (facilities || []);

    if (activeSearch && searchResults?.results) {
      if (buildingFilter) {
        list = list.filter((f) => f.building_or_area.toLowerCase().includes(buildingFilter.toLowerCase()));
      }
      if (facilityTypeFilter) {
        list = list.filter((f) => f.facility_type.toLowerCase().includes(facilityTypeFilter.toLowerCase()));
      }
      if (statusFilter) {
        list = list.filter((f) => f.primary_status.toUpperCase() === statusFilter.toUpperCase());
      }
      if (freshnessFilter) {
        list = list.filter((f) => f.freshness.toLowerCase() === freshnessFilter.toLowerCase());
      }
    }

    if (sortBy === 'name') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'freshness') {
      return [...list].sort((a, b) => {
        const order = { Fresh: 3, Stale: 2, Expired: 1, 'No Evidence': 0 };
        return (order[b.freshness as keyof typeof order] || 0) - (order[a.freshness as keyof typeof order] || 0);
      });
    } else if (sortBy === 'proximity') {
      return [...list].sort((a, b) => {
        const distA = a.distance_meters !== null && a.distance_meters !== undefined ? a.distance_meters : 99999;
        const distB = b.distance_meters !== null && b.distance_meters !== undefined ? b.distance_meters : 99999;
        return distA - distB;
      });
    }
    return list;
  }, [facilities, searchResults, activeSearch, buildingFilter, facilityTypeFilter, statusFilter, freshnessFilter, sortBy]);

  // Aggregate stats from current result set
  const stats = useMemo(() => {
    const list = displayFacilities;
    let working = 0;
    let unavailable = 0;
    let conflicting = 0;
    let unknown = 0;

    for (const f of list) {
      if (f.primary_status === 'LIKELY_WORKING') working++;
      else if (f.primary_status === 'LIKELY_UNAVAILABLE') unavailable++;
      else if (f.primary_status === 'CONFLICTING') conflicting++;
      else unknown++;
    }
    return { total: list.length, working, unavailable, conflicting, unknown };
  }, [displayFacilities]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Search Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="max-w-3xl mx-auto text-center space-y-3">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            What do you need right now?
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Search naturally or click a priority need. Verified by decay-weighted student observations.
          </p>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative mt-4">
            <div className="relative flex items-center">
              <Search size={20} className="absolute left-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. 'I need drinking water near ABB-1' or 'working printer'"
                className="w-full pl-11 pr-24 py-3.5 text-sm sm:text-base rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all bg-slate-50/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-20 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="Clear search text"
                >
                  <X size={16} />
                </button>
              )}
              <button
                type="submit"
                className="absolute right-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs sm:text-sm rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Search
              </button>
            </div>
          </form>

          {/* Natural Language Parsed Feedback */}
          {activeSearch && searchResults?.parsed_intent && (
            <div className="mt-3 p-3 bg-teal-50/80 border border-teal-200 rounded-xl text-left flex flex-wrap items-center justify-between gap-2 text-xs text-teal-900">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-teal-600 shrink-0" />
                <span>
                  Query intent interpreted:{' '}
                  <strong>{searchResults.parsed_intent.detected_feature_type || 'General inquiry'}</strong>
                  {searchResults.parsed_intent.detected_area && (
                    <span> • Area: <strong>{searchResults.parsed_intent.detected_area}</strong></span>
                  )}
                </span>
              </div>
              <span className="font-mono text-[10px] bg-teal-100 px-2 py-0.5 rounded text-teal-800">
                {searchResults.parsed_intent.source}
              </span>
            </div>
          )}
        </div>

        {/* Quick-Select Needs Chips */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 text-center sm:text-left">
            Quick Select Priority Need:
          </div>
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {QUICK_NEEDS.map((need) => {
              const Icon = need.icon;
              const isSelected = selectedNeed === need.id;
              return (
                <button
                  key={need.id}
                  type="button"
                  onClick={() => {
                    setSelectedNeed(isSelected ? null : need.id);
                    if (activeSearch) clearSearch();
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-teal-600 text-white border-teal-600 shadow-xs ring-2 ring-teal-200'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
                  }`}
                >
                  <Icon size={15} className={isSelected ? 'text-white' : need.color} />
                  <span>{need.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter Bar & Status Overview Counters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Status Counters */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
            Total: <strong>{stats.total}</strong>
          </span>
          <span className="px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 size={13} />
            <span>Likely Working: <strong>{stats.working}</strong></span>
          </span>
          <span className="px-3 py-1.5 bg-rose-50 text-rose-800 rounded-lg border border-rose-200 flex items-center gap-1">
            <XCircle size={13} />
            <span>Likely Unavailable: <strong>{stats.unavailable}</strong></span>
          </span>
          <span className="px-3 py-1.5 bg-amber-50 text-amber-900 rounded-lg border border-amber-200 flex items-center gap-1">
            <AlertTriangle size={13} />
            <span>Conflicting: <strong>{stats.conflicting}</strong></span>
          </span>
          <span className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg border border-slate-200 flex items-center gap-1">
            <HelpCircle size={13} />
            <span>Unknown: <strong>{stats.unknown}</strong></span>
          </span>
        </div>

        {/* Filter dropdowns and sort */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Building area filter */}
          <select
            value={buildingFilter}
            onChange={(e) => setBuildingFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:ring-1 focus:ring-teal-500"
            aria-label="Filter by campus building"
          >
            <option value="">All Campus Areas</option>
            <option value="ABB-I">ABB-I</option>
            <option value="ABB-II">ABB-II</option>
            <option value="LRC">LRC Library</option>
            <option value="Annexe">Annexe II</option>
            <option value="Shastri">Shastri Hostel</option>
            <option value="Tagore">Tagore Hostel</option>
            <option value="Sarojini">Sarojini Hostel</option>
            <option value="Sports">Sports Complex</option>
          </select>

          {/* Facility Type filter */}
          <select
            value={facilityTypeFilter}
            onChange={(e) => setFacilityTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:ring-1 focus:ring-teal-500"
            aria-label="Filter by facility type"
          >
            <option value="">All Facility Types</option>
            <option value="Campus Laundry">Campus Laundry</option>
            <option value="Drinking Water">Drinking Water</option>
            <option value="Printing Station">Printing Station</option>
            <option value="Elevator">Elevator / Lift</option>
            <option value="Step-Free">Step-Free Access</option>
            <option value="Restroom">Accessible Restroom</option>
            <option value="Charging">Charging Hub</option>
            <option value="Study">Study Space</option>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:ring-1 focus:ring-teal-500"
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            <option value="LIKELY_WORKING">Likely Working</option>
            <option value="LIKELY_UNAVAILABLE">Likely Unavailable</option>
            <option value="CONFLICTING">Conflicting</option>
            <option value="UNKNOWN">Unknown</option>
          </select>

          {/* Freshness filter */}
          <select
            value={freshnessFilter}
            onChange={(e) => setFreshnessFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:ring-1 focus:ring-teal-500"
            aria-label="Filter by freshness"
          >
            <option value="">All Freshness</option>
            <option value="fresh">Fresh (Within half-life)</option>
            <option value="stale">Stale (Decayed)</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-1 focus:ring-teal-500"
            aria-label="Sort facilities"
          >
            <option value="best_match">Sort: Best Match & Reliability</option>
            <option value="proximity">Sort: Proximity (Nearest First)</option>
            <option value="freshness">Sort: Freshest Evidence</option>
            <option value="name">Sort: Facility Name</option>
          </select>

          {/* Location Toggle Button */}
          <button
            type="button"
            onClick={handleToggleLocation}
            disabled={isLocating}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer min-h-[34px] ${
              userLocation
                ? 'bg-teal-50 border-teal-300 text-teal-800 shadow-xs'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
            title={userLocation ? `${userLocation.label} active - click to clear` : 'Enable campus proximity sorting'}
          >
            <MapPin size={13} className={userLocation ? 'text-teal-600' : 'text-slate-400'} />
            <span>
              {isLocating
                ? 'Locating...'
                : userLocation
                ? userLocation.label
                : '📍 Near Me'}
            </span>
          </button>

          {/* Refresh button & indicator */}
          <div className="flex items-center gap-1.5">
            {dataUpdatedAt > 0 && (
              <span className="hidden sm:inline text-[10px] text-slate-400 font-mono">
                Updated: {new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:text-teal-700 hover:border-teal-500 transition-colors cursor-pointer"
              title="Refresh live data"
              aria-label="Refresh live data"
            >
              <RefreshCw size={15} className={isRefetching ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Facility Results Grid */}
      <div>
        {isLoading || isSearching ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse space-y-4">
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-6 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
                <div className="h-16 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : displayFacilities.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Search size={22} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No matching facilities found</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              No campus facilities match the applied criteria. Remember: <strong>Unknown does not mean unavailable</strong>. Try clearing filters or submit a new observation!
            </p>
            <button
              onClick={() => {
                clearSearch();
                setSelectedNeed(null);
                setBuildingFilter('');
                setFacilityTypeFilter('');
                setStatusFilter('');
                setFreshnessFilter('');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayFacilities.map((facility) => (
              <FacilityCard
                key={facility.id}
                facility={facility}
                onSelect={(id) => setSelectedFacilityId(id)}
                onReport={(facId, featId) => onOpenReportModal(facId, featId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Facility Detail Modal */}
      <FacilityDetailModal
        facilityId={selectedFacilityId}
        onClose={() => setSelectedFacilityId(null)}
        onReport={(facId, featId) => {
          setSelectedFacilityId(null);
          onOpenReportModal(facId, featId);
        }}
        onSelectAlternative={(altId) => setSelectedFacilityId(altId)}
      />
    </div>
  );
};
