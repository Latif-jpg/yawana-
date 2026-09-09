/**
 * Point d'entrée central pour tous les types TypeScript du projet MarketRadar.
 * Importer les types depuis ce fichier pour une cohérence maximale.
 */

// Types de données métier (données Supabase)
export type {
  PriceRow,
  DashboardSummaryRow,
  SnapshotRow,
  ExternalSourceHealth,
  UserRewardSummary,
  UserPriceHistoryRow,
  ProductConsultationRow,
  BoutiqueItemRow,
  SearchableProductRow,
  SearchableProductsDebugRow,
  ChatConversationRow,
  ChatMessageRow,
  ProfileRow,
  PriceAlertActionRow,
  PriceAlertRow,
} from '@/libs/queries/types';

// Types d'analyse et de données externes
export type { PricePoint } from '@/libs/analytics';
export type { ExternalPricePoint, MarketPriceSnapshotRow } from '@/libs/scanner';
