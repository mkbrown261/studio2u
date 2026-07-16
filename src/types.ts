export type Bindings = {
  DB: D1Database
  R2: R2Bucket
  ADMIN_PASSWORD?: string
}

export type AppEnv = {
  Bindings: Bindings
}

export interface Engineer {
  id: number
  name: string
  bio: string | null
  photo_url: string | null
  genres: string | null
  travel_radius_miles: number | null
  cashapp_handle: string | null
  rating: number
  is_active: number
}

export interface Service {
  id: number
  slug: string
  name: string
  description: string | null
  is_bookable: number
  base_rate_note: string | null
  sort_order: number
}

export type BookingStatus =
  | 'pending_payment'
  | 'pending_approval'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'rejected'

export interface Booking {
  id: number
  customer_id: number
  engineer_id: number
  service_id: number
  session_date: string
  session_time: string
  duration_hours: number
  is_custom_time_request: number
  location_type: string
  location_address: string | null
  special_notes: string | null
  song_count: number | null
  genre: string | null
  customer_name: string
  customer_email: string
  customer_phone: string
  is_first_time_rate: number
  price_amount: number
  price_breakdown: string | null
  payment_method: string
  payment_proof_url: string | null
  payment_transaction_id: string | null
  status: BookingStatus
  admin_notes: string | null
  created_at: string
  updated_at: string
}
