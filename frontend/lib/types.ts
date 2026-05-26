export type Order = {
  id: string;
  user_id: string;
  customer_name: string;
  address: string;
  phone?: string;
  lat?: number;
  lng?: number;
  geocoded: boolean;
  status: string;
  created_at: string;
};

export type Driver = {
  id: string;
  user_id: string;
  name: string;
  phone?: string;
  vehicle?: string;
  capacity: number;
  color: string;
  access_token: string;
  current_lat?: number;
  current_lng?: number;
  last_seen?: string;
  start_address?: string;
  start_lat?: number;
  start_lng?: number;
};

export type Profile = {
  id: string;
  email: string;
  full_name?: string;
  company_name?: string;
  depot_lat: number;
  depot_lng: number;
  depot_address: string;
  depot_postcode: string;
  avg_speed_kmh: number;
  fuel_price_gbp: number;
  vehicle_kml: number;
};

export type OptimizeResponse = {
  routes: Array<{
    driver_id: string;
    driver_name: string;
    driver_color: string;
    start_lat: number;
    start_lng: number;
    stops: Array<{
      order_id: string;
      customer_name: string;
      address: string;
      lat: number;
      lng: number;
      sequence: number;
      eta_minutes: number;
      eta_clock: string;
    }>;
    distance_km: number;
    duration_minutes: number;
  }>;
  total_distance_km: number;
  baseline_distance_km: number;
  distance_saved_km: number;
  fuel_saved_litres: number;
  fuel_saved_gbp: number;
  algorithm: string;
};
