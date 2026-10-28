export type ReportedStatus = 'WORKING' | 'UNAVAILABLE' | 'UNCERTAIN';
export type EvaluatedStatus = 'LIKELY_WORKING' | 'LIKELY_UNAVAILABLE' | 'CONFLICTING' | 'UNKNOWN';
export type ConfidenceLabel = 'High' | 'Medium' | 'Low' | 'Unknown';
export type FreshnessLabel = 'Fresh' | 'Stale' | 'Expired' | 'No Evidence';
export type SourceType = 'STUDENT_REPORT' | 'MAINTENANCE_STAFF' | 'ON_SITE_OBSERVATION';

export interface FeatureAssessment {
  feature_id: string;
  feature_type: string;
  display_name: string;
  status: EvaluatedStatus;
  freshness: FreshnessLabel;
  confidence_score: number;
  confidence_label: ConfidenceLabel;
  reason_code: string;
  explanation: string;
  supporting_reports_count: number;
  conflicting_reports_count: number;
  total_reports_count: number;
  last_reported_at?: string;
  last_confirmed_working_at?: string;
  is_demo_data: boolean;
  evidence_breakdown: {
    working_weight?: number;
    unavailable_weight?: number;
    uncertain_weight?: number;
    total_effective_weight?: number;
    half_life_hours?: number;
    unique_report_clusters?: number;
    most_recent_age_hours?: number;
  };
  summary_text?: string;
  summary_source?: string;
}

export interface FacilityFeature {
  id: string;
  facility_id: string;
  feature_type: string;
  display_name: string;
  description?: string;
  created_at: string;
}

export interface Report {
  id: string;
  facility_id: string;
  feature_id: string;
  reported_status: ReportedStatus;
  source_type: SourceType;
  note?: string;
  evidence_url?: string;
  is_anonymous: boolean;
  crowd_level?: 'Low' | 'Medium' | 'High';
  laundry_status?: 'Ready' | 'Delayed' | 'Not ready' | 'Collected';
  estimated_time?: string;
  moderation_status: string;
  is_demo_data: boolean;
  created_at: string;
}

export interface FacilityCard {
  id: string;
  name: string;
  description?: string;
  facility_type: string;
  building_or_area: string;
  latitude?: number;
  longitude?: number;
  static_map_url?: string;
  directions_url?: string;
  opening_hours?: string;
  is_demo_data: boolean;
  created_at: string;
  updated_at: string;
  features: FacilityFeature[];
  primary_status: EvaluatedStatus;
  primary_feature_name?: string;
  confidence_label: ConfidenceLabel;
  confidence_score: number;
  freshness: FreshnessLabel;
  distance_meters?: number;
  recommendation_reason?: string;
  feature_assessments: FeatureAssessment[];
}

export interface FacilityDetail extends FacilityCard {
  recent_reports: Report[];
  alternatives: FacilityCard[];
}

export interface AnalyticsOverview {
  total_facilities: number;
  total_features: number;
  total_reports: number;
  likely_working_features: number;
  likely_unavailable_features: number;
  conflicting_features: number;
  unknown_features: number;
  fresh_features: number;
  stale_features: number;
  demo_data_notice: string;
  recent_reports: Report[];
}

export interface SearchResponse {
  query: string;
  parsed_intent: {
    query: string;
    detected_feature_type?: string;
    suggested_status?: string;
    detected_area?: string;
    source: string;
  };
  results_count: number;
  results: FacilityCard[];
}

export interface MapsConfig {
  google_maps_enabled: boolean;
  campus_name: string;
  campus_center: {
    latitude: number;
    longitude: number;
  };
}

export interface WalkingRoute {
  status: string;
  source: string;
  distance_meters: number;
  duration_seconds: number;
  duration_minutes: number;
  duration_formatted: string;
  polyline?: string;
}

export interface ReportSubmission {
  facility_id: string;
  feature_id: string;
  reported_status: ReportedStatus;
  source_type: SourceType;
  note?: string;
  evidence_url?: string;
  is_anonymous: boolean;
  crowd_level?: 'Low' | 'Medium' | 'High';
  laundry_status?: 'Ready' | 'Delayed' | 'Not ready' | 'Collected';
  estimated_time?: string;
}
