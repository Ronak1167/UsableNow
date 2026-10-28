import type {
  FacilityCard,
  FacilityDetail,
  FacilityFeature,
  Report,
  ReportSubmission,
  SearchResponse,
  AnalyticsOverview,
  MapsConfig,
  WalkingRoute
} from '../types';
import {
  FALLBACK_FACILITIES,
  FALLBACK_ANALYTICS,
  FALLBACK_FACILITY_DETAILS,
} from './fallbackData';

const envApiUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
export const API_BASE = envApiUrl ? (envApiUrl.endsWith('/api') ? envApiUrl : `${envApiUrl}/api`) : '/api';

export function resolveApiUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/api') && base.endsWith('/api')) {
    const root = base.slice(0, -4);
    return `${root}${cleanPath}`;
  }
  return `${base}${cleanPath}`;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      let errMessage = `Request failed with status ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson && errJson.detail) {
          errMessage = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {
        // use default message
      }
      throw new ApiError(errMessage, res.status);
    }

    return await res.json() as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err instanceof Error ? err.message : 'Network error or backend unreachable', 0);
  }
}

export const api = {
  getHealth: async () => {
    try {
      return await request<{ status: string; database: string; facilities_count: number; version: string; ai_mode: string }>('/health');
    } catch {
      return {
        status: 'healthy',
        database: 'connected (demo static fallback)',
        facilities_count: 17,
        version: '1.0.0',
        ai_mode: 'deterministic_local_fallback',
      };
    }
  },

  getFacilities: async (params?: {
    feature_type?: string;
    building?: string;
    facility_type?: string;
    status_filter?: string;
    freshness_filter?: string;
    user_lat?: number;
    user_lon?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.feature_type) query.set('feature_type', params.feature_type);
    if (params?.building) query.set('building', params.building);
    if (params?.facility_type) query.set('facility_type', params.facility_type);
    if (params?.status_filter) query.set('status_filter', params.status_filter);
    if (params?.freshness_filter) query.set('freshness_filter', params.freshness_filter);
    if (params?.user_lat !== undefined) query.set('user_lat', params.user_lat.toString());
    if (params?.user_lon !== undefined) query.set('user_lon', params.user_lon.toString());
    const qs = query.toString();
    try {
      return await request<FacilityCard[]>(`/facilities${qs ? `?${qs}` : ''}`);
    } catch {
      let list = [...FALLBACK_FACILITIES];
      if (params?.building) {
        list = list.filter((f) => f.building_or_area.toLowerCase().includes(params.building!.toLowerCase()));
      }
      if (params?.facility_type) {
        list = list.filter((f) => f.facility_type.toLowerCase() === params.facility_type!.toLowerCase());
      }
      if (params?.status_filter) {
        list = list.filter((f) => f.primary_status === params.status_filter);
      }
      return list;
    }
  },

  getMapsConfig: async () => {
    try {
      return await request<MapsConfig>('/maps/config');
    } catch {
      return {
        google_maps_enabled: true,
        campus_name: 'JIIT Noida Sector 62 Campus',
        campus_center: { latitude: 28.62970, longitude: 77.37210 },
      };
    }
  },

  getWalkingRoute: async (originLat: number, originLon: number, destLat: number, destLon: number) => {
    const q = new URLSearchParams({
      origin_lat: originLat.toString(),
      origin_lon: originLon.toString(),
      destination_lat: destLat.toString(),
      destination_lon: destLon.toString(),
    });
    try {
      return await request<WalkingRoute>(`/maps/walking-route?${q.toString()}`);
    } catch {
      // Calculate Haversine fallback locally
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const R = 6371000;
      const dLat = toRad(destLat - originLat);
      const dLon = toRad(destLon - originLon);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(originLat)) * Math.cos(toRad(destLat)) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = Math.round(R * c);
      const durationSecs = Math.max(30, Math.round(dist / 1.34));
      const mins = Math.max(1, Math.round(durationSecs / 60));
      return {
        status: 'OK',
        source: 'haversine_fallback',
        distance_meters: dist,
        duration_seconds: durationSecs,
        duration_minutes: mins,
        duration_formatted: `~${mins} min walk`,
      };
    }
  },

  getFacilityDetail: async (facilityId: string) => {
    try {
      return await request<FacilityDetail>(`/facilities/${facilityId}`);
    } catch {
      const fallback = FALLBACK_FACILITY_DETAILS[facilityId];
      if (fallback) return fallback;
      throw new ApiError('Facility not found in offline dataset', 404);
    }
  },

  getFeatures: (featureType?: string) =>
    request<FacilityFeature[]>(`/features${featureType ? `?feature_type=${featureType}` : ''}`),

  searchFacilities: async (query: string) => {
    try {
      return await request<SearchResponse>(`/search?q=${encodeURIComponent(query)}`);
    } catch {
      const lower = query.toLowerCase();
      const matched = FALLBACK_FACILITIES.filter((f) =>
        f.name.toLowerCase().includes(lower) ||
        (f.description && f.description.toLowerCase().includes(lower)) ||
        f.building_or_area.toLowerCase().includes(lower) ||
        f.facility_type.toLowerCase().includes(lower)
      );
      return {
        query,
        parsed_intent: {
          query,
          detected_feature_type: null,
          suggested_status: null,
          detected_area: null,
          source: 'Local Client-side Filter',
        },
        results_count: matched.length,
        results: matched,
      };
    }
  },

  getRecommendations: async (featureType: string, userLat?: number, userLon?: number) => {
    const q = new URLSearchParams({ feature_type: featureType });
    if (userLat !== undefined) q.set('user_lat', userLat.toString());
    if (userLon !== undefined) q.set('user_lon', userLon.toString());
    try {
      return await request<FacilityCard[]>(`/recommendations?${q.toString()}`);
    } catch {
      return FALLBACK_FACILITIES.filter((f) =>
        f.facility_type.toLowerCase().includes(featureType.toLowerCase()) ||
        f.features.some((feat) => feat.feature_type.toLowerCase().includes(featureType.toLowerCase()))
      ).slice(0, 5);
    }
  },

  submitReport: async (data: ReportSubmission) => {
    try {
      return await request<Report>('/reports', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      return {
        id: `rep_${Date.now()}`,
        facility_id: data.facility_id,
        feature_id: data.feature_id,
        reported_status: data.reported_status,
        source_type: data.source_type,
        note: data.note || null,
        evidence_url: data.evidence_url || null,
        is_anonymous: Boolean(data.is_anonymous),
        crowd_level: data.crowd_level || null,
        laundry_status: data.laundry_status || null,
        estimated_time: data.estimated_time || null,
        moderation_status: 'PENDING',
        is_demo_data: false,
        created_at: new Date().toISOString(),
      };
    }
  },

  getAnalyticsOverview: async () => {
    try {
      return await request<AnalyticsOverview>('/analytics/overview');
    } catch {
      return FALLBACK_ANALYTICS;
    }
  },

  resetDemoDatabase: (adminKey: string) =>
    request<{ message: string; details: any }>('/admin/reset-demo', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
    }),

  moderateReport: (reportId: string, action: 'APPROVED' | 'REJECTED' | 'FLAGGED', adminKey: string, reason?: string) =>
    request<{ message: string }>(`/admin/reports/${reportId}/moderate?action=${action}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`, {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
    }),
};
