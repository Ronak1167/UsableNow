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
  getHealth: () => request<{ status: string; database: string; facilities_count: number; version: string; ai_mode: string }>('/health'),

  getFacilities: (params?: {
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
    return request<FacilityCard[]>(`/facilities${qs ? `?${qs}` : ''}`);
  },

  getMapsConfig: () =>
    request<MapsConfig>('/maps/config'),

  getWalkingRoute: (originLat: number, originLon: number, destLat: number, destLon: number) => {
    const q = new URLSearchParams({
      origin_lat: originLat.toString(),
      origin_lon: originLon.toString(),
      destination_lat: destLat.toString(),
      destination_lon: destLon.toString(),
    });
    return request<WalkingRoute>(`/maps/walking-route?${q.toString()}`);
  },

  getFacilityDetail: (facilityId: string) =>
    request<FacilityDetail>(`/facilities/${facilityId}`),

  getFeatures: (featureType?: string) =>
    request<FacilityFeature[]>(`/features${featureType ? `?feature_type=${featureType}` : ''}`),

  searchFacilities: (query: string) =>
    request<SearchResponse>(`/search?q=${encodeURIComponent(query)}`),

  getRecommendations: (featureType: string, userLat?: number, userLon?: number) => {
    const q = new URLSearchParams({ feature_type: featureType });
    if (userLat !== undefined) q.set('user_lat', userLat.toString());
    if (userLon !== undefined) q.set('user_lon', userLon.toString());
    return request<FacilityCard[]>(`/recommendations?${q.toString()}`);
  },

  submitReport: (data: ReportSubmission) =>
    request<Report>('/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getAnalyticsOverview: () =>
    request<AnalyticsOverview>('/analytics/overview'),

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
