import type { ExternalPricePoint, MarketPriceSnapshotRow } from '@/libs/scanner';
import type { PricePoint } from '@/libs/analytics';

export interface PriceRow extends PricePoint {
  products?: { name?: string; category?: string; unit?: string } | null;
  markets?: { name?: string; city_id?: string } | null;
  shops?: { id?: string; name?: string; contact_info?: string; trust_score?: number; is_verified?: boolean; owner_id?: string | null } | null;
  quantity: number;
  currency: string;
  reliability_status?: 'pending' | 'confirmed' | 'conflicted' | 'trusted' | null;
  reliability_score?: number | null;
  validation_note?: string | null;
  verified_at?: string | null;
}

export interface DashboardSummaryRow {
  product_id: string;
  market_id: string;
  product_name: string;
  product_category: string;
  product_unit: string;
  market_name: string;
  city_id: string;
  latest_price: number;
  previous_price: number | null;
  change_percent: number | null;
  trend: number[];
  shop_name: string | null;
  shop_verified: boolean;
  seller_id: string | null;
  shop_trust_score: number | null;
}

export interface SnapshotRow extends MarketPriceSnapshotRow {
  products?: { name?: string; category?: string; unit?: string } | null;
  markets?: { name?: string; city_id?: string } | null;
  updated_at: string;
}

export interface ExternalSourceHealth {
  mode: 'ai_web_search' | 'public_dataset' | 'unknown';
  collectedAt: string | null;
  sourceName: string | null;
}

export interface UserRewardSummary {
  reward_user_id: string;
  reward_price_count: number;
  reward_confirmed_count: number;
  reward_corrected_count: number;
  reward_dismissed_count: number;
  reward_contribution_points: number;
  reward_confirmation_points: number;
  reward_correction_points: number;
  reward_focus_bonus: number;
  reward_total_points: number;
  reward_level: number;
  reward_next_level_at: number;
  reward_progress_to_next_level: number;
  reward_trust_score: number;
}

export interface UserPriceHistoryRow {
  id: string;
  product_id: string;
  market_id: string;
  price_value: number;
  quantity: number;
  currency: string;
  created_at: string;
  reliability_status?: 'pending' | 'confirmed' | 'conflicted' | 'trusted' | null;
  reliability_score?: number | null;
  validation_note?: string | null;
  verified_at?: string | null;
  products?: { name?: string; category?: string; unit?: string } | null;
  markets?: { name?: string; city_id?: string } | null;
}

export interface ProductConsultationRow {
  id: string;
  user_id?: string | null;
  market_id: string;
  product_id: string;
  source?: string | null;
  created_at: string;
  products?: { name?: string; category?: string; unit?: string } | null;
}

export interface BoutiqueItemRow {
  id: string;
  owner_id: string;
  product_id?: string | null;
  label: string;
  category: string;
  unit: string;
  price_value?: number | null;
  image_url?: string | null;
  is_visible_in_search?: boolean | null;
  created_at: string;
  updated_at?: string | null;
}

export interface SearchableProductRow {
  id: string;
  resolved_product_id?: string | null;
  boutique_item_id?: string | null;
  owner_id?: string | null;
  seller_full_name?: string | null;
  seller_trust_score?: number | null;
  seller_market_access_tier?: string | null;
  seller_verified_market_badge?: boolean | null;
  name: string;
  category: string;
  unit: string;
  image_url?: string | null;
  price_value?: number | null;
  source: 'catalog' | 'boutique';
  is_visible_in_search?: boolean | null;
  created_at?: string | null;
}

export interface SearchableProductsDebugRow {
  id: string;
  user_id?: string | null;
  stage: string;
  payload?: any;
  created_at: string;
}

export interface ChatConversationRow {
  id: string;
  product_id: string;
  seller_id: string;
  client_id: string;
  last_message_preview?: string | null;
  last_message_at?: string | null;
  created_at: string;
  products?: {
    id?: string;
    name?: string;
    category?: string;
    unit?: string;
    image_url?: string | null;
  } | null;
}

export interface ChatMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at?: string | null;
}

export interface ProfileRow {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  role?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  city_id?: string | null;
  trust_score?: number | null;
  level?: number | null;
  points?: number | null;
  market_access_tier?: string | null;
  verified_market_badge?: boolean | null;
  verified_market_badge_at?: string | null;
  preferred_market_id?: string | null;
  last_location_latitude?: number | null;
  last_location_longitude?: number | null;
  last_location_verified_at?: string | null;
}

export interface PriceAlertActionRow {
  id: string;
  alert_id: string;
  user_id: string;
  action_type: 'viewed' | 'confirmed' | 'dismissed' | 'updated_price';
  created_at?: string;
  price_alerts?: { product_id?: string | null; market_id?: string | null } | null;
}

export interface PriceAlertRow {
  id: string;
  alert_key: string;
  product_id: string;
  market_id: string;
  alert_type: 'stale_price' | 'price_spike' | 'conflict' | 'opportunity';
  title: string;
  message: string;
  priority: number;
  signal_value: number | null;
  status: 'active' | 'resolved' | 'dismissed';
  created_at: string;
  updated_at: string;
  current_price?: number | null;
  snapshot_status?: SnapshotRow['status'] | null;
  snapshot_confidence?: number | null;
  products?: { name?: string; category?: string; unit?: string } | null;
  markets?: { name?: string; city_id?: string } | null;
}
