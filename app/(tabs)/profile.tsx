import { Alert, Dimensions, Image, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Platform } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Award,
  BellRing,
  CheckCircle2,
  Edit2,
  Eye,
  EyeOff,
  History,
  Info,
  MapPin,
  MessageCircle,
  ShoppingBag,
  Settings,
  Shield,
  type LucideIcon,
  X,
  Zap,
  Trash2,
} from 'lucide-react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useToast } from '@/components/ToastProvider';
import { Typography } from '@/components/Typography';
import { EditProfileModal, HistoryDetailModal, PriceCorrectionModal, SettingsModal } from '@/components/profile';
import { Colors, Layout, Radius, Shadows, Spacing } from '@/constants/Theme';
import { useAuth } from '@/libs/auth';
import { supabase } from '@/libs/supabase';
import { useBoutiqueProductDemand } from '@/libs/queries/boutique';
import { formatPrice, formatTimeAgo } from '@/libs/format';
import { formatProductCategory, normalizeProductName, normalizeUnit } from '@/libs/normalization';
import {
  useActOnPriceAlert,
  useAddBoutiqueItem,
  useDeleteBoutiqueItem,
  useAddProduct,
  useAddPrice,
  DEMO_SELLER_PROFILE_ID,
  useChatInbox,
  useCities,
  useMarketsWithCoords,
  useProfile,
  useTargetedPriceAlerts,
  useUpdateProfile,
  useUpdateBoutiqueItem,
  useUserAlertActions,
  useUserBadges,
  useUserBoutiqueItems,
  useUserPriceHistory,
  useUserRecentMarkets,
  useUserRewardSummary,
  useUserStats,
  useProducts,
  useZoneLeaderboard,
} from '@/libs/queries';

const { width: screenWidth } = Dimensions.get('window');
const GUEST_ID = '00000000-0000-0000-0000-000000000000';
const AUTO_ZONE_RETRY_MS = 30000;
const LOCATION_REFRESH_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_NEARBY_MARKET_DISTANCE_KM = 80;
const MAX_CITY_MATCH_DISTANCE_KM = 25;

type BusinessCriterion = {
  id: string;
  label: string;
  achieved: boolean;
  details: string;
};

type RoadmapItem = {
  id: string;
  title: string;
  description: string;
  achieved: boolean;
  details: string;
  points?: number;
};

const SELLER_LIKE_ROLES = new Set(['seller', 'merchant', 'commercant']);

const SELLER_ACCESS_CRITERIA = [
  {
    id: 'city',
    label: 'Ville rattachée',
    details: 'Le profil doit être relié à une ville pour ouvrir l’accès local.',
  },
  {
    id: 'activity',
    label: '10 prix saisis',
    details: 'Un vendeur crédible doit déjà alimenter le réseau avec assez de relevés.',
  },
  {
    id: 'trust',
    label: 'Confiance à 60/100',
    details: 'Le score de fiabilité protège la qualité des prix exposés.',
  },
  {
    id: 'proof',
    label: '3 confirmations ou 2 corrections',
    details: 'On valide la pratique terrain avant d’ouvrir la mise en avant locale.',
  },
] as const;

const CLIENT_TICKET_ROADMAP = [
  {
    id: 'discovery',
    title: 'Ticket découverte',
    description: 'Premier palier pour débloquer l’usage avancé.',
    points: 30,
    details: '30 points, 1 saisie utile et au moins une présence active dans le réseau.',
  },
  {
    id: 'local',
    title: 'Ticket local',
    description: 'Ouvre les bons d’achat et les signaux prioritaires.',
    points: 90,
    details: '90 points, 3 confirmations et une fiabilité minimale correcte.',
  },
  {
    id: 'priority',
    title: 'Ticket prioritaire',
    description: 'Réservé aux clients très actifs et fiables.',
    points: 150,
    details: '150 points et une confiance élevée pour accéder aux avantages premium.',
  },
] as const;

const BADGE_ROADMAP = [
  {
    id: 'pioneer',
    title: 'Pionnier',
    description: 'Premier prix ajouté',
    details: 'Débloqué dès la première contribution de prix.',
  },
  {
    id: 'analyst',
    title: 'Analyste',
    description: '10 relevés de prix',
    details: 'Débloqué après 10 prix publiés sur la plateforme.',
  },
  {
    id: 'sentinel',
    title: 'Sentinelle',
    description: '3 confirmations ou 2 corrections',
    details: 'Débloqué quand le profil montre une vraie rigueur terrain.',
  },
] as const;

function getAlertActionGuidance(alertType?: string) {
  switch (alertType) {
    case 'stale_price':
      return 'Priorité métier : confirmer si ce prix est encore observé aujourd’hui.';
    case 'price_spike':
      return 'Priorité métier : vérifier si la hausse est réelle ou ponctuelle.';
    case 'conflict':
      return 'Priorité métier : ajouter un relevé pour départager des prix incohérents.';
    case 'opportunity':
      return 'Priorité métier : vérifier rapidement si le bon plan est toujours disponible.';
    default:
      return 'Votre action aide à fiabiliser le signal local.';
  }
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const radiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return radiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const findNearestMarket = (
  latitude: number,
  longitude: number,
  markets: Array<{ id?: string; name?: string; latitude?: number; longitude?: number }>
) => {
  let nearest: (typeof markets)[number] | null = null;
  let minDistance = Infinity;

  markets.forEach((market) => {
    if (typeof market.latitude !== 'number' || typeof market.longitude !== 'number') {
      return;
    }

    const distance = calculateDistance(latitude, longitude, market.latitude, market.longitude);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = market;
    }
  });

  return { nearest, minDistance };
};

const findNearestCityFromMarkets = (
  latitude: number,
  longitude: number,
  markets: Array<{ city_id?: string; latitude?: number; longitude?: number }>
) => {
  const marketsByCity = new Map<string, Array<{ city_id?: string; latitude?: number; longitude?: number }>>();

  markets.forEach((market) => {
    if (!market.city_id || typeof market.latitude !== 'number' || typeof market.longitude !== 'number') {
      return;
    }

    const current = marketsByCity.get(market.city_id) ?? [];
    current.push(market);
    marketsByCity.set(market.city_id, current);
  });

  let bestCityId: string | null = null;
  let bestDistance = Infinity;
  let bestCityMarkets: Array<{ city_id?: string; latitude?: number; longitude?: number }> = [];

  marketsByCity.forEach((cityMarkets, cityId) => {
    const centroid = cityMarkets.reduce<{ latitude: number; longitude: number }>(
      (acc, market) => {
        acc.latitude += market.latitude ?? 0;
        acc.longitude += market.longitude ?? 0;
        return acc;
      },
      { latitude: 0, longitude: 0 }
    );

    const avgLatitude = centroid.latitude / cityMarkets.length;
    const avgLongitude = centroid.longitude / cityMarkets.length;
    const distance = calculateDistance(latitude, longitude, avgLatitude, avgLongitude);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestCityId = cityId;
      bestCityMarkets = cityMarkets;
    }
  });

  return { cityId: bestCityId, cityMarkets: bestCityMarkets, distanceKm: bestDistance };
};

const matchesCityName = (candidate: string, cityName: string) => {
  const normalizedCandidate = normalizeProductName(candidate);
  const normalizedCity = normalizeProductName(cityName);

  return (
    normalizedCandidate === normalizedCity ||
    normalizedCandidate.includes(normalizedCity) ||
    normalizedCity.includes(normalizedCandidate)
  );
};

function getEntryReliabilityStatus(input: {
  entry: any;
  pairActionStatus: Map<string, 'confirmed' | 'updated_price' | 'dismissed'>;
  activeAlertPairs: Set<string>;
}) {
  const pairKey = `${input.entry.product_id}:${input.entry.market_id}`;
  const actionStatus = input.pairActionStatus.get(pairKey);
  const reliabilityStatus = String(input.entry.reliability_status || '').toLowerCase();
  const score = Number(input.entry.reliability_score ?? 0);

  if (actionStatus === 'updated_price') {
    return {
      id: 'corrected',
      label: 'Correction envoyée',
      color: Colors.primary,
      bg: Colors.primary + '12',
      note: 'Un nouveau relevé a été soumis pour corriger cette référence.',
      scoreLabel: null,
    };
  }

  if (reliabilityStatus === 'trusted') {
    return {
      id: 'confirmed',
      label: 'Fiable',
      color: Colors.emerald,
      bg: Colors.emerald + '12',
      note: input.entry.validation_note || 'Plusieurs relevés cohérents soutiennent ce prix.',
      scoreLabel: `${Math.round(score * 100)}% confiance`,
    };
  }

  if (reliabilityStatus === 'confirmed') {
    return {
      id: 'confirmed',
      label: 'Confirmé',
      color: Colors.emerald,
      bg: Colors.emerald + '12',
      note: input.entry.validation_note || 'Le prix est cohérent avec les relevés proches.',
      scoreLabel: score > 0 ? `${Math.round(score * 100)}% confiance` : null,
    };
  }

  if (reliabilityStatus === 'conflicted') {
    return {
      id: 'pending',
      label: 'À vérifier',
      color: Colors.error,
      bg: Colors.error + '12',
      note: input.entry.validation_note || 'Des relevés voisins se contredisent encore.',
      scoreLabel: score > 0 ? `${Math.round(score * 100)}% confiance` : null,
    };
  }

  if (input.activeAlertPairs.has(pairKey)) {
    return {
      id: 'pending',
      label: 'À confirmer',
      color: Colors.gold,
      bg: Colors.gold + '18',
      note: 'Une alerte locale attend encore une vérification terrain.',
      scoreLabel: score > 0 ? `${Math.round(score * 100)}% confiance` : null,
    };
  }

  if (actionStatus === 'confirmed') {
    return {
      id: 'confirmed',
      label: 'Confirmation envoyée',
      color: Colors.emerald,
      bg: Colors.emerald + '12',
      note: 'Votre confirmation a été enregistrée. Le serveur recalculera la fiabilité.',
      scoreLabel: score > 0 ? `${Math.round(score * 100)}% confiance` : null,
    };
  }

  return {
    id: 'pending',
    label: 'En attente',
    color: Colors.textSecondary,
    bg: Colors.background,
    note: input.entry.validation_note || 'Le relevé est conservé, mais il manque encore des recoupements.',
    scoreLabel: score > 0 ? `${Math.round(score * 100)}% confiance` : null,
  };
}

export default function ProfileScreen() {
  const { session, user, signOut, isLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const currentUserId = user?.id || GUEST_ID;
  const [profileTab, setProfileTab] = useState<'profil' | 'boutique'>('boutique');

  const canWriteProfile = !!session && !!user?.id;
  const { data: profile, isLoading: isLoadingProfile } = useProfile(currentUserId);
  const { data: stats } = useUserStats(currentUserId, { enabled: profileTab === 'profil' });
  const { data: userBadges } = useUserBadges(currentUserId, { enabled: profileTab === 'profil' });
  const { data: rewardSummary } = useUserRewardSummary(currentUserId);
  const { data: zoneLeaderboard } = useZoneLeaderboard(profile?.city_id, profile?.role, { enabled: profileTab === 'profil' });
  const { data: recentMarkets } = useUserRecentMarkets(currentUserId);
  const { data: cities } = useCities();
  const { data: geoMarkets } = useMarketsWithCoords();
  const { data: alertActions } = useUserAlertActions(currentUserId, { enabled: profileTab === 'profil' });
  const { data: priceHistory } = useUserPriceHistory(currentUserId, { enabled: profileTab === 'profil' });
  const { data: products } = useProducts();
  const updateProfile = useUpdateProfile();
  const addProductMutation = useAddProduct();
  const addBoutiqueItem = useAddBoutiqueItem();
  const updateBoutiqueItem = useUpdateBoutiqueItem();
  const deleteBoutiqueItem = useDeleteBoutiqueItem();
  const actOnAlert = useActOnPriceAlert();
  const addPrice = useAddPrice();
  const [targetMarketId, setTargetMarketId] = useState<string | null>(null);
  const [profileSection, setProfileSection] = useState<'boutique' | 'contributions' | 'recompenses' | 'activite'>('boutique');
  const [boutiqueFilter, setBoutiqueFilter] = useState<'all' | 'demand' | 'recent'>('all');
  const { data: boutiqueItems } = useUserBoutiqueItems(currentUserId);
  const boutiqueProductIds = useMemo(
    () => (boutiqueItems ?? []).map((item: any) => item.product_id).filter(Boolean),
    [boutiqueItems]
  );
  const { data: boutiqueProductDemand } = useBoutiqueProductDemand(boutiqueProductIds);
  const { data: chatInbox } = useChatInbox(currentUserId);
  const recentChats = useMemo(() => (chatInbox ?? []).slice(0, 3), [chatInbox]);

  const badgeIcons: Record<string, LucideIcon> = {
    award: Award,
    zap: Zap,
    shield: Shield,
  };
  const isDemoSellerProfile = currentUserId === DEMO_SELLER_PROFILE_ID;
  const hasFreshSavedLocation = useMemo(() => {
    if (!profile?.last_location_verified_at) {
      return false;
    }

    const verifiedAt = Date.parse(profile.last_location_verified_at);
    if (!Number.isFinite(verifiedAt)) {
      return false;
    }

    return Date.now() - verifiedAt < LOCATION_REFRESH_INTERVAL_MS;
  }, [profile?.last_location_verified_at]);

  const savedPreferredMarket = useMemo(() => {
    if (!profile?.preferred_market_id) {
      return null;
    }

    return (geoMarkets ?? []).find((market: any) => market.id === profile.preferred_market_id) ?? null;
  }, [geoMarkets, profile?.preferred_market_id]);

  const locationRefreshKey = useMemo(
    () =>
      [
        profile?.id || '',
        profile?.city_id || '',
        profile?.preferred_market_id || '',
        profile?.last_location_verified_at || '',
      ].join('|'),
    [profile?.city_id, profile?.id, profile?.last_location_verified_at, profile?.preferred_market_id]
  );
  const lastLocationRefreshKeyRef = useRef<string | null>(null);
  const boutiqueCatalogSyncRef = useRef<string | null>(null);

  const performSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    try {
      setIsSigningOut(true);
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Déconnexion impossible',
        message: (error as any)?.message || 'La session n’a pas pu être fermée.',
      });
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    if (Platform.OS === 'web') {
      const confirmed =
        typeof globalThis.confirm === 'function'
          ? globalThis.confirm('Voulez-vous vraiment vous déconnecter ?')
          : true;

      if (confirmed) {
        await performSignOut();
      }
      return;
    }

    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion',
        style: 'destructive',
        onPress: () => {
          void performSignOut();
        },
      },
    ]);
  };

  useEffect(() => {
    if (session && user && !isLoadingProfile && !profile) {
      updateProfile.mutate({
        id: user.id,
        full_name: user.email?.split('@')[0] || 'Utilisateur',
        phone: typeof user.user_metadata?.phone === 'string' ? user.user_metadata.phone : undefined,
        role: typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : 'client',
        bio: typeof user.user_metadata?.bio === 'string' ? user.user_metadata.bio : undefined,
      });
    }
  }, [isLoadingProfile, profile, session, updateProfile, user]);

  useEffect(() => {
    if (!session || !user || !profile || updateProfile.isPending) {
      return;
    }

    const metadataPhone = typeof user.user_metadata?.phone === 'string' ? user.user_metadata.phone : null;
    const metadataName =
      typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()
        ? user.user_metadata.full_name.trim()
        : user.email?.split('@')[0] || null;
    const metadataRole =
      typeof user.user_metadata?.role === 'string' ? user.user_metadata.role.trim().toLowerCase() : null;

    const shouldSyncPhone = !!metadataPhone && metadataPhone !== profile.phone;
    const profileName = String(profile.full_name || '').trim().toLowerCase();
    const shouldSyncName =
      !!metadataName &&
      (metadataName !== profile.full_name || !profile.full_name || profileName === 'visiteur anonyme');
    const profileRole = String(profile.role || 'client').toLowerCase();
    const shouldSyncRole =
      !!metadataRole &&
      metadataRole !== 'client' &&
      (profile.role == null || profileRole === 'client');
    const syncKey = [
      metadataName || '',
      metadataPhone || '',
      metadataRole || '',
      profile.full_name || '',
      profile.phone || '',
      profile.role || '',
    ].join('|');

    if (!shouldSyncPhone && !shouldSyncName && !shouldSyncRole) {
      return;
    }

    if (lastMetadataSyncKeyRef.current === syncKey) {
      return;
    }

    lastMetadataSyncKeyRef.current = syncKey;

    updateProfile.mutate({
      id: user.id,
      phone: shouldSyncPhone ? metadataPhone! : profile.phone,
      full_name: shouldSyncName ? metadataName! : profile.full_name,
      role: shouldSyncRole ? metadataRole! : profile.role,
      bio: profile.bio,
      city_id: profile.city_id,
      preferred_market_id: profile.preferred_market_id,
      last_location_latitude: profile.last_location_latitude,
      last_location_longitude: profile.last_location_longitude,
      last_location_verified_at: profile.last_location_verified_at,
    });
  }, [profile, session, updateProfile, user]);

  const { data: priceAlerts } = useTargetedPriceAlerts({
    cityId: profile?.city_id,
    marketId: targetMarketId,
    role: profile?.role,
  });

  const [editModal, setEditModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBio, setNewBio] = useState('');
  const [newRole, setNewRole] = useState('client');
  const [newCityId, setNewCityId] = useState<string | null>(null);
  const [boutiqueLabel, setBoutiqueLabel] = useState('');
  const [boutiqueCategory, setBoutiqueCategory] = useState('');
  const [boutiqueUnit, setBoutiqueUnit] = useState('pièce');
  const [boutiquePrice, setBoutiquePrice] = useState('');
  const [boutiqueImageUrl, setBoutiqueImageUrl] = useState('');
  const [boutiqueImageMimeType, setBoutiqueImageMimeType] = useState<string | null>(null);
  const [editingBoutiqueItemId, setEditingBoutiqueItemId] = useState<string | null>(null);
  const [correctionModal, setCorrectionModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<any | null>(null);
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<any | null>(null);
  const [correctedPrice, setCorrectedPrice] = useState('');
  const [isDetectingZone, setIsDetectingZone] = useState(false);
  const [alertFeedback, setAlertFeedback] = useState<{ tone: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [settingsModal, setSettingsModal] = useState(false);
  const [showDetailedProfile, setShowDetailedProfile] = useState(false);
  const [zoneDetectionState, setZoneDetectionState] = useState<
    'idle' | 'detecting' | 'permission_denied' | 'not_found' | 'resolved'
  >('idle');
  const [zoneDetectionDebug, setZoneDetectionDebug] = useState<string | null>(null);
  const lastAutoZoneAttemptRef = useRef(0);
  const lastMetadataSyncKeyRef = useRef<string | null>(null);

  const confirmedAlertsCount = (alertActions ?? []).filter((action: any) => action.action_type === 'confirmed').length;
  const correctedAlertsCount = (alertActions ?? []).filter((action: any) => action.action_type === 'updated_price').length;
  const dedupedAlerts = Array.from(
    ((priceAlerts ?? []).reduce((map: Map<string, any>, alert: any) => {
      const key = `${alert.product_id}:${alert.market_id}`;
      const current = map.get(key);
      if (!current || alert.priority > current.priority) {
        map.set(key, alert);
      }
      return map;
    }, new Map()) as Map<string, any>).values()
  );
  const visibleAlerts = dedupedAlerts.slice(0, 3);
  const alertActionIndex = new Map(
    (alertActions ?? []).map((action: any) => [`${action.alert_id}:${action.action_type}`, true])
  );
  const pairActionStatus = new Map<string, 'confirmed' | 'updated_price' | 'dismissed'>();
  (alertActions ?? []).forEach((action: any) => {
    const productId = action.price_alerts?.product_id;
    const marketId = action.price_alerts?.market_id;
    if (!productId || !marketId) {
      return;
    }
    const key = `${productId}:${marketId}`;
    const nextType = String(action.action_type || '');
    const current = pairActionStatus.get(key);

    if (nextType === 'updated_price') {
      pairActionStatus.set(key, 'updated_price');
      return;
    }

    if (nextType === 'confirmed' && current !== 'updated_price') {
      pairActionStatus.set(key, 'confirmed');
      return;
    }

    if (nextType === 'dismissed' && !current) {
      pairActionStatus.set(key, 'dismissed');
    }
  });
  const activeAlertPairs = new Set((dedupedAlerts ?? []).map((alert: any) => `${alert.product_id}:${alert.market_id}`));
  const historyEntries = [...(priceHistory ?? [])].sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const targetMarket = (geoMarkets ?? []).find((market: any) => market.id === targetMarketId)
    || (recentMarkets ?? []).find((entry: any) => entry.market_id === targetMarketId)?.markets
    || null;
  const normalizedRole = String(profile?.role || 'client').toLowerCase();
  const isSellerProfile = SELLER_LIKE_ROLES.has(normalizedRole);
  const recentMarketCount = useMemo(() => new Set((recentMarkets ?? []).map((entry: any) => entry.market_id).filter(Boolean)).size, [recentMarkets]);
  const sellerZoneRank = useMemo(() => {
    if (!isSellerProfile || !zoneLeaderboard?.length || !profile?.id) return null;
    const match = (zoneLeaderboard as any[]).find((entry) => entry.userId === profile.id);
    return match?.rank ?? null;
  }, [isSellerProfile, profile?.id, zoneLeaderboard]);
  const verifiedSellerAccess = Boolean(profile?.verified_market_badge || String(profile?.market_access_tier || '').toLowerCase() === 'verified');
  const resolvedLevel = rewardSummary?.level ?? profile?.level ?? 1;
  const resolvedPoints = rewardSummary?.totalPoints ?? profile?.points ?? 0;
  const resolvedTrustScore = rewardSummary?.trustScore ?? profile?.trust_score ?? 35;
  const profileCityName = cities?.find((city: any) => city.id === profile?.city_id)?.name || 'non definie';
  const profileLocationStatus = hasFreshSavedLocation ? 'récente' : profile?.last_location_verified_at ? 'à réactualiser' : 'à confirmer';
  const profileConsistencyKey = [
    profile?.id || '',
    profile?.city_id || '',
    profile?.preferred_market_id || '',
    profile?.last_location_verified_at || '',
    savedPreferredMarket?.city_id || '',
  ].join('|');
  const profileConsistencyRef = useRef<string | null>(null);

  const sellerAccessCriteria = useMemo<BusinessCriterion[]>(() => {
    if (isDemoSellerProfile) {
      return SELLER_ACCESS_CRITERIA.map((criterion) => ({
        ...criterion,
        achieved: true,
      }));
    }

    const priceCount = rewardSummary?.priceCount ?? 0;
    const trustScore = resolvedTrustScore;
    const confirmedCount = rewardSummary?.confirmedCount ?? 0;
    const correctedCount = rewardSummary?.correctedCount ?? 0;

    return SELLER_ACCESS_CRITERIA.map((criterion) => {
      if (criterion.id === 'city') {
        return {
          ...criterion,
          achieved: !!profile?.city_id,
        };
      }

      if (criterion.id === 'activity') {
        return {
          ...criterion,
          achieved: priceCount >= 10,
        };
      }

      if (criterion.id === 'trust') {
        return {
          ...criterion,
          achieved: trustScore >= 60,
        };
      }

      return {
        ...criterion,
        achieved: confirmedCount >= 3 || correctedCount >= 2,
      };
    });
  }, [isDemoSellerProfile, profile?.city_id, resolvedTrustScore, rewardSummary]);

  const sellerAccessEligible = sellerAccessCriteria.every((criterion) => criterion.achieved);
  const sellerAccessMissing = sellerAccessCriteria.filter((criterion) => !criterion.achieved).map((criterion) => criterion.label);

  const clientTicketRoadmap = useMemo<RoadmapItem[]>(() => {
    if (isDemoSellerProfile) {
      return CLIENT_TICKET_ROADMAP.map((ticket) => ({
        ...ticket,
        achieved: true,
      }));
    }

    const totalPoints = rewardSummary?.totalPoints ?? 0;
    const priceCount = rewardSummary?.priceCount ?? 0;
    const confirmedCount = rewardSummary?.confirmedCount ?? 0;
    const trustScore = resolvedTrustScore;

    return CLIENT_TICKET_ROADMAP.map((ticket) => {
      if (ticket.id === 'discovery') {
        return {
          ...ticket,
          achieved: totalPoints >= ticket.points && priceCount >= 1,
        };
      }

      if (ticket.id === 'local') {
        return {
          ...ticket,
          achieved: totalPoints >= ticket.points && confirmedCount >= 3 && trustScore >= 45,
        };
      }

      return {
        ...ticket,
        achieved: totalPoints >= ticket.points && trustScore >= 60,
      };
    });
  }, [isDemoSellerProfile, resolvedTrustScore, rewardSummary]);

  const badgeRoadmap = useMemo<RoadmapItem[]>(() => {
    if (isDemoSellerProfile) {
      return BADGE_ROADMAP.map((badge) => ({
        ...badge,
        achieved: true,
      }));
    }

    const priceCount = rewardSummary?.priceCount ?? 0;
    const confirmedCount = rewardSummary?.confirmedCount ?? 0;
    const correctedCount = rewardSummary?.correctedCount ?? 0;

    return BADGE_ROADMAP.map((badge) => {
      if (badge.id === 'pioneer') {
        return {
          ...badge,
          achieved: priceCount >= 1,
        };
      }

      if (badge.id === 'analyst') {
        return {
          ...badge,
          achieved: priceCount >= 10,
        };
      }

      return {
        ...badge,
        achieved: confirmedCount >= 3 || correctedCount >= 2,
      };
    });
  }, [isDemoSellerProfile, rewardSummary]);

  const rewardGoal =
    isSellerProfile
      ? {
          title: 'Accès marché vendeur',
          description: 'Le vendeur doit être localisé, crédible et actif pour être mis en avant.',
          unlock: sellerAccessEligible
            ? 'Accès vendeur ouvert pour la mise en avant locale.'
            : `À compléter: ${sellerAccessMissing.join(' · ')}`,
        }
      : {
          title: 'Ticket client',
          description: 'Les tickets débloquent les bons d’achat et les avantages locaux.',
          unlock:
            clientTicketRoadmap.find((item) => item.id === 'local')?.achieved
              ? 'Vous êtes éligible au ticket local.'
              : `Encore ${Math.max(0, 90 - (rewardSummary?.totalPoints || 0))} pts pour débloquer le ticket local.`,
        };

  const handleBuyVerifiedBadge = () => {
    if (!canWriteProfile || verifiedSellerAccess) {
      return;
    }

    Alert.alert(
      'Acheter le badge vérifié',
      'Ce badge ouvre la palette 2: visibilité renforcée, top 100 automatique, messagerie client-vendeur et proposition de livraison.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Activer',
          onPress: async () => {
            try {
              await updateProfile.mutateAsync({
                id: currentUserId,
                full_name: profile?.full_name,
                phone: profile?.phone,
                role: profile?.role,
                bio: profile?.bio,
                city_id: profile?.city_id,
                market_access_tier: 'verified',
                verified_market_badge: true,
                verified_market_badge_at: new Date().toISOString(),
              } as any);
              showToast({
                tone: 'success',
                title: 'Badge vérifié activé',
                message: 'Votre profil passe en palette 2 avec visibilité premium.',
              });
            } catch (error: any) {
              showToast({
                tone: 'error',
                title: 'Activation impossible',
                message: error?.message || 'Impossible d’activer le badge vérifié pour le moment.',
              });
            }
          },
        },
      ]
    );
  };

  const handlePickBoutiqueImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast({
        tone: 'info',
        title: 'Accès aux photos requis',
        message: 'Autorise Yawana à accéder à tes photos pour ajouter une image produit.',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      const asset = result.assets[0];
      const maxSide = Math.max(asset.width ?? 0, asset.height ?? 0);
      const actions =
        maxSide > 1280
          ? [{ resize: { width: asset.width >= asset.height ? 1280 : Math.round((asset.width / asset.height) * 1280) } }]
          : [];

      // On compresse avant même de conserver l'URI : l'original lourd ne sera
      // jamais envoyé à Supabase.
      const compressed = await ImageManipulator.manipulateAsync(asset.uri, actions, {
        compress: 0.72,
        format: ImageManipulator.SaveFormat.JPEG,
      });

      setBoutiqueImageUrl(compressed.uri);
      setBoutiqueImageMimeType('image/jpeg');
    }
  };

  const resolveBoutiqueImageUrl = async (imageUri: string, mimeType?: string | null) => {
    const normalizedUri = imageUri.trim();
    if (!normalizedUri || /^https?:\/\//i.test(normalizedUri)) {
      return normalizedUri || null;
    }

    // Android peut renvoyer une URI locale content:// ou file://.
    // fetch() la traite comme une URL réseau et échoue avec Network request failed.
    const base64 = await FileSystem.readAsStringAsync(normalizedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    if (!bytes.length) {
      throw new Error('La photo sélectionnée est vide ou illisible.');
    }

    const contentType = mimeType || 'image/jpeg';
    const extension = contentType.includes('png') ? 'png' : 'jpg';
    const path = `${currentUserId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(path, bytes, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload photo impossible : ${uploadError.message}`);
    }

    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const startEditBoutiqueItem = (item: any) => {
    setEditingBoutiqueItemId(item.id);
    setBoutiqueLabel(item.label || '');
    setBoutiqueCategory(item.category || '');
    setBoutiqueUnit(item.unit || 'pièce');
    setBoutiquePrice(item.price_value != null ? String(item.price_value) : '');
    setBoutiqueImageUrl(item.image_url || '');
    setBoutiqueImageMimeType(null);
  };

  const toggleBoutiqueVisibility = async (item: any) => {
    try {
      await updateBoutiqueItem.mutateAsync({
        id: item.id,
        owner_id: currentUserId,
        is_visible_in_search: !item.is_visible_in_search,
      });
      showToast({
        tone: 'success',
        title: item.is_visible_in_search ? 'Produit masqué' : 'Produit visible',
        message: item.is_visible_in_search ? 'Le produit reste dans ta boutique mais sort des recherches.' : 'Le produit peut maintenant apparaître dans les boutiques éligibles.',
      });
    } catch (error: any) {
      showToast({ tone: 'error', title: 'Visibilité impossible', message: error?.message || 'Impossible de modifier la visibilité.' });
    }
  };

  const confirmDeleteBoutiqueItem = (item: any) => {
    Alert.alert('Supprimer ce produit ?', `${item.label} sera retiré de ta boutique.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBoutiqueItem.mutateAsync({ id: item.id, owner_id: currentUserId });
            if (editingBoutiqueItemId === item.id) setEditingBoutiqueItemId(null);
            showToast({ tone: 'success', title: 'Produit supprimé', message: 'Le produit a été retiré de ta boutique.' });
          } catch (error: any) {
            showToast({ tone: 'error', title: 'Suppression impossible', message: error?.message || 'Impossible de supprimer ce produit.' });
          }
        },
      },
    ]);
  };

  const handleAddBoutiqueItem = async () => {
    if (!canWriteProfile) {
      return;
    }

    if (!boutiqueLabel.trim()) {
      showToast({
        tone: 'info',
        title: 'Libellé requis',
        message: 'Donne un nom à ce produit boutique avant de l’ajouter.',
      });
      return;
    }

    try {
      const label = boutiqueLabel.trim();
      const imageUrl = await resolveBoutiqueImageUrl(boutiqueImageUrl, boutiqueImageMimeType);
      const category = formatProductCategory(boutiqueCategory);
      if (!category) {
        showToast({
          tone: 'info',
          title: 'Catégorie requise',
          message: 'Choisis une vraie catégorie produit pour qu’il soit indexé dans les recherches.',
        });
        return;
      }

      const unit = boutiqueUnit.trim() || 'pièce';
      const parsedPrice = boutiquePrice.trim() ? Number(boutiquePrice) : null;

      if (editingBoutiqueItemId) {
        await updateBoutiqueItem.mutateAsync({
          id: editingBoutiqueItemId,
          owner_id: currentUserId,
          label,
          category,
          unit,
          price_value: parsedPrice !== null && Number.isFinite(parsedPrice) ? parsedPrice : null,
          image_url: imageUrl,
        });

        setEditingBoutiqueItemId(null);
        setBoutiqueLabel('');
        setBoutiqueCategory('');
        setBoutiqueUnit('pièce');
        setBoutiquePrice('');
        setBoutiqueImageUrl('');
        setBoutiqueImageMimeType(null);
        showToast({ tone: 'success', title: 'Produit modifié', message: 'Les informations de ta boutique ont été mises à jour.' });
        return;
      }

      const canExposeBoutiqueItem = sellerAccessEligible || verifiedSellerAccess || isDemoSellerProfile;
      const existingProduct = canExposeBoutiqueItem
        ? (products ?? []).find((product: any) => {
            return (
              normalizeProductName(product.name || '') === normalizeProductName(label) &&
              normalizeProductName(product.category || '') === normalizeProductName(category) &&
              normalizeProductName(product.unit || 'unit') === normalizeProductName(unit)
            );
          })
        : null;

      const linkedProduct =
        existingProduct ||
        (canExposeBoutiqueItem
          ? await addProductMutation.mutateAsync({
              name: label,
              category,
              unit,
              image_url: imageUrl,
            })
          : null);

      await addBoutiqueItem.mutateAsync({
        owner_id: currentUserId,
        product_id: linkedProduct?.id ?? null,
        label,
        category,
        unit,
        price_value: parsedPrice !== null && Number.isFinite(parsedPrice) ? parsedPrice : null,
        image_url: imageUrl,
        is_visible_in_search: canExposeBoutiqueItem,
      });

      setBoutiqueLabel('');
      setBoutiqueCategory('');
      setBoutiqueUnit('pièce');
      setBoutiquePrice('');
      setBoutiqueImageUrl('');
      setBoutiqueImageMimeType(null);

      showToast({
        tone: 'success',
        title: 'Produit boutique ajouté',
        message: 'Le produit est prêt à être présenté dans l’espace boutique.',
      });
    } catch (error: any) {
      showToast({
        tone: 'error',
        title: 'Ajout impossible',
        message: error?.message || 'Impossible d’enregistrer ce produit boutique.',
      });
    }
  };

  const handleUpdate = async () => {
    if (!canWriteProfile) {
      return;
    }

    try {
      await updateProfile.mutateAsync({
        id: currentUserId,
        full_name: newName || profile?.full_name,
        bio: newBio || profile?.bio,
        role: newRole || profile?.role,
        city_id: newCityId,
      });
      showToast({
        tone: 'success',
        title: 'Profil mis à jour',
        message: 'Vos informations ont bien été enregistrées.',
      });
      setEditModal(false);
    } catch (error: any) {
      showToast({
        tone: 'error',
        title: 'Mise à jour impossible',
        message: error?.message || 'Impossible d enregistrer vos changements.',
      });
    }
  };

  const openEdit = () => {
    setNewName(profile?.full_name || '');
    setNewBio(profile?.bio || '');
    setNewRole(profile?.role || 'client');
    setNewCityId(profile?.city_id || null);
    setEditModal(true);
  };

  const handleDetectProfileCity = async () => {
    if (!canWriteProfile) {
      showToast({
        tone: 'info',
        title: 'Connexion requise',
        message: 'Connectez-vous pour enregistrer votre ville sur le profil.',
      });
      return;
    }

    const result = await detectZoneFromGps();

    if (!result?.cityId) {
      showToast({
        tone: 'error',
        title: 'Ville introuvable',
        message: 'Impossible de rattacher votre ville par GPS pour le moment.',
      });
      return;
    }

    setNewCityId(result.cityId);
    showToast({
      tone: 'success',
      title: 'Ville rattachée',
      message: result.cityName
        ? `${result.cityName} est maintenant enregistrée sur votre profil.`
        : 'Votre ville est maintenant enregistrée sur votre profil.',
    });
  };

  const openCorrection = (alert: any) => {
    setSelectedAlert(alert);
    setCorrectedPrice(alert.current_price ? String(Math.round(alert.current_price)) : '');
    setCorrectionModal(true);
  };

  const handleCorrection = async () => {
    if (!session || !user?.id || !selectedAlert || !correctedPrice) {
      return;
    }

    const userId = user.id;

    try {
      await addPrice.mutateAsync({
        product_id: selectedAlert.product_id,
        market_id: selectedAlert.market_id,
        price_value: Number(correctedPrice),
        quantity: 1,
        recorded_by: userId,
      });

      if (selectedAlert?.id && !String(selectedAlert.id).startsWith('history-')) {
        await actOnAlert.mutateAsync({
          alertId: selectedAlert.id,
          userId,
          actionType: 'updated_price',
        });
      }

      setCorrectionModal(false);
      setSelectedAlert(null);
      setCorrectedPrice('');
      setAlertFeedback({
        tone: 'success',
        message: selectedAlert?.id && !String(selectedAlert.id).startsWith('history-')
          ? 'Correction enregistree. Le nouveau prix servira de reference locale.'
          : 'Nouveau relevé ajouté à partir de l’historique.',
      });
      showToast({
        tone: 'success',
        title: 'Correction enregistrée',
        message: 'Le nouveau prix a été ajouté et compte pour votre activité.',
      });
      Alert.alert('Correction enregistree', 'Le nouveau prix a ete ajoute et compte pour votre activite.');
    } catch (error: any) {
      setAlertFeedback({
        tone: 'error',
        message: error.message || 'Impossible d enregistrer la correction.',
      });
      showToast({
        tone: 'error',
        title: 'Correction impossible',
        message: error.message || 'Impossible d enregistrer la correction.',
      });
      Alert.alert('Erreur', error.message || 'Impossible d enregistrer la correction.');
    }
  };

  const handleConfirm = async (alert: any) => {
    if (!session || !user?.id) {
      showToast({
        tone: 'info',
        title: 'Connexion requise',
        message: 'Connectez-vous pour confirmer ou corriger une alerte.',
      });
      Alert.alert('Connexion requise', 'Connectez-vous pour confirmer ou corriger une alerte.');
      return;
    }

    const userId = user.id;

    try {
      await actOnAlert.mutateAsync({
        alertId: alert.id,
        userId,
        actionType: 'confirmed',
      });

      setAlertFeedback({
        tone: 'success',
        message: `Confirmation prise en compte pour ${alert.products?.name || 'ce produit'}.`,
      });
      showToast({
        tone: 'success',
        title: 'Prix confirmé',
        message: 'La confirmation a bien été prise en compte pour votre profil.',
      });
      Alert.alert('Prix confirme', 'La confirmation a bien ete prise en compte pour votre profil.');
    } catch (error: any) {
      setAlertFeedback({
        tone: 'error',
        message: error.message || 'Impossible de confirmer ce prix.',
      });
      showToast({
        tone: 'error',
        title: 'Confirmation impossible',
        message: error.message || 'Impossible de confirmer ce prix.',
      });
      Alert.alert('Erreur', error.message || 'Impossible de confirmer ce prix.');
    }
  };

  const inferZoneFromActivity = async () => {
    if (!canWriteProfile) {
      return null;
    }

    const { data, error } = await supabase
      .from('prices')
      .select('markets(city_id)')
      .eq('recorded_by', currentUserId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return null;
    }

    const counts = new Map<string, number>();

    (data ?? []).forEach((row: any) => {
      const cityId = row.markets?.city_id;
      if (!cityId) {
        return;
      }

      counts.set(cityId, (counts.get(cityId) ?? 0) + 1);
    });

    if (!counts.size) {
      return null;
    }

    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
  };

  const persistProfileCity = async (input: {
    cityId: string;
    marketId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    detectedAt?: string | null;
  }) => {
    await updateProfile.mutateAsync({
      id: currentUserId,
      full_name: profile?.full_name,
      phone: profile?.phone,
      role: profile?.role,
      bio: profile?.bio,
      avatar_url: profile?.avatar_url,
      city_id: input.cityId,
      preferred_market_id: input.marketId ?? profile?.preferred_market_id ?? null,
      last_location_latitude: input.latitude ?? profile?.last_location_latitude,
      last_location_longitude: input.longitude ?? profile?.last_location_longitude,
      last_location_verified_at: input.detectedAt ?? profile?.last_location_verified_at ?? new Date().toISOString(),
    });
  };

  const detectZoneFromGps = async (): Promise<{ cityId: string; marketId?: string | null; cityName?: string | null } | null> => {
    if (!canWriteProfile) {
      return null;
    }

    lastAutoZoneAttemptRef.current = Date.now();
    setIsDetectingZone(true);
    setZoneDetectionState('detecting');
    setZoneDetectionDebug(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const activityCityId = await inferZoneFromActivity();
        if (activityCityId) {
          await persistProfileCity({ cityId: activityCityId });
          setZoneDetectionState('resolved');
          const cityName = (cities ?? []).find((city: any) => city.id === activityCityId)?.name ?? null;
          return { cityId: activityCityId, cityName };
        }
        setZoneDetectionState('permission_denied');
        return null;
      }

      const location =
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          mayShowUserSettingsDialog: true,
        })) || (await Location.getLastKnownPositionAsync());

      if (!location) {
        setZoneDetectionState('not_found');
        return null;
      }

      const { latitude, longitude } = location.coords;
      const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
      const geocodedNames = geocoded
        .flatMap((item) => [item.city, item.subregion, item.region, item.district])
        .filter(Boolean)
        .map((value) => String(value));
      setZoneDetectionDebug(`coords=${latitude.toFixed(4)},${longitude.toFixed(4)} | reverse=${geocodedNames.join('/') || 'empty'}`);

      let matchedCity = (cities ?? []).find((city: any) =>
        geocodedNames.some((name) => matchesCityName(name, city.name))
      );
      const allMarkets = ((geoMarkets ?? []).filter(
        (market: any) => typeof market.latitude === 'number' && typeof market.longitude === 'number'
      ) as Array<{ id?: string; name?: string; city_id?: string; latitude?: number; longitude?: number }>);
      let cityMarkets = matchedCity?.id
        ? allMarkets.filter((market: any) => market.city_id === matchedCity.id)
        : [];

      if (!matchedCity || !cityMarkets.length) {
        const fallbackCity = findNearestCityFromMarkets(latitude, longitude, allMarkets);
        const fallbackCityData = fallbackCity.cityId
          ? (cities ?? []).find((city: any) => city.id === fallbackCity.cityId)
          : null;

        if (
          fallbackCityData &&
          fallbackCity.cityMarkets.length &&
          Number.isFinite(fallbackCity.distanceKm) &&
          fallbackCity.distanceKm <= MAX_CITY_MATCH_DISTANCE_KM
        ) {
          matchedCity = fallbackCityData;
          cityMarkets = fallbackCity.cityMarkets as any[];
        }
      }

      if (matchedCity?.id) {
        const matchedCityId = (matchedCity as any).id as string;
        const nearestMarketInCity: { id?: string; name?: string; latitude?: number; longitude?: number } | null = cityMarkets.length
          ? findNearestMarket(latitude, longitude, cityMarkets).nearest
          : null;
        const detectedAt = new Date().toISOString();
        const nearestMarketId = (nearestMarketInCity as any)?.id as string | undefined;

        if (nearestMarketId) {
          setTargetMarketId(nearestMarketId);
        }

        await persistProfileCity({
          cityId: matchedCityId,
          marketId: nearestMarketId ?? null,
          latitude,
          longitude,
          detectedAt,
        });
        setZoneDetectionState('resolved');
        return { cityId: matchedCityId, marketId: nearestMarketId ?? null, cityName: matchedCity.name };
      }

      let nearestMarket: any | null = null;
      let shortestDistance = Infinity;

      (geoMarkets ?? []).forEach((market: any) => {
        if (typeof market.latitude !== 'number' || typeof market.longitude !== 'number') {
          return;
        }

        const distance = calculateDistance(latitude, longitude, market.latitude, market.longitude);
        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestMarket = market;
        }
      });

      if (
        !nearestMarket?.city_id ||
        !Number.isFinite(shortestDistance) ||
        shortestDistance > MAX_NEARBY_MARKET_DISTANCE_KM
      ) {
        const activityCityId = await inferZoneFromActivity();
        if (activityCityId) {
          await persistProfileCity({
            cityId: activityCityId,
            latitude,
            longitude,
            detectedAt: new Date().toISOString(),
          });
          setZoneDetectionState('resolved');
          const cityName = (cities ?? []).find((city: any) => city.id === activityCityId)?.name ?? null;
          setZoneDetectionDebug((prev) => `${prev || ''} | fallback=activity`);
          return { cityId: activityCityId, cityName };
        }

        setZoneDetectionDebug((prev) =>
          `${prev || ''} | nearest=${nearestMarket?.name || 'none'} | distance=${
            Number.isFinite(shortestDistance) ? shortestDistance.toFixed(1) : 'inf'
          }km | markets=${(geoMarkets ?? []).length}`
        );
        setZoneDetectionState('not_found');
        return null;
      }

      setTargetMarketId(nearestMarket.id);
      await persistProfileCity({
        cityId: nearestMarket.city_id,
        marketId: nearestMarket.id,
        latitude,
        longitude,
        detectedAt: new Date().toISOString(),
      });
      setZoneDetectionState('resolved');
      const cityName = (cities ?? []).find((city: any) => city.id === nearestMarket.city_id)?.name ?? null;
      return { cityId: nearestMarket.city_id, marketId: nearestMarket.id, cityName };
    } catch (error: any) {
      const message = String(error?.message || error?.code || error || 'unknown');
      console.info('[profile:gps-city-detection]', {
        status: 'failed',
        message,
        debug: zoneDetectionDebug,
        markets: (geoMarkets ?? []).length,
        cities: (cities ?? []).length,
      });
      setZoneDetectionDebug((prev) => `${prev || ''} | error=${message}`);
      setZoneDetectionState('not_found');
      return null;
    } finally {
      setIsDetectingZone(false);
    }
  };

  useEffect(() => {
    if (!canWriteProfile || !profile) {
      return;
    }

    if (hasFreshSavedLocation) {
      setZoneDetectionState('resolved');
      if (savedPreferredMarket?.id && targetMarketId !== savedPreferredMarket.id) {
        setTargetMarketId(savedPreferredMarket.id);
      }
      return;
    }

    if (!profile.last_location_verified_at) {
      return;
    }

    if (lastLocationRefreshKeyRef.current === locationRefreshKey) {
      return;
    }

    lastLocationRefreshKeyRef.current = locationRefreshKey;

    if (!isDetectingZone) {
      void detectZoneFromGps();
    }
  }, [
    canWriteProfile,
    hasFreshSavedLocation,
    isDetectingZone,
    locationRefreshKey,
    profile,
    savedPreferredMarket,
    targetMarketId,
  ]);

  useEffect(() => {
    if (targetMarketId) {
      return;
    }

    const fallbackMarket =
      savedPreferredMarket ||
      (recentMarkets ?? []).find((entry: any) => !profile?.city_id || entry.markets?.city_id === profile.city_id);

    if (fallbackMarket?.id) {
      setTargetMarketId(fallbackMarket.id);
      return;
    }

    if (fallbackMarket?.market_id) {
      setTargetMarketId(fallbackMarket.market_id);
    }
  }, [profile?.city_id, recentMarkets, savedPreferredMarket, targetMarketId]);

  useEffect(() => {
    if (!session || !user || !profile || !savedPreferredMarket?.city_id || !hasFreshSavedLocation) {
      return;
    }

    const normalizedCityId = savedPreferredMarket.city_id;
    if (profile.city_id === normalizedCityId) {
      return;
    }

    if (profileConsistencyRef.current === profileConsistencyKey) {
      return;
    }

    profileConsistencyRef.current = profileConsistencyKey;
    updateProfile.mutate({
      id: user.id,
      city_id: normalizedCityId,
      preferred_market_id: profile.preferred_market_id || savedPreferredMarket.id || null,
      last_location_latitude: profile.last_location_latitude,
      last_location_longitude: profile.last_location_longitude,
      last_location_verified_at: profile.last_location_verified_at,
      full_name: profile.full_name,
      phone: profile.phone,
      role: profile.role,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
    });
  }, [
    hasFreshSavedLocation,
    profile,
    profileConsistencyKey,
    savedPreferredMarket,
    session,
    updateProfile,
    user,
  ]);

  const boutiqueSearchVisible = sellerAccessEligible || verifiedSellerAccess || isDemoSellerProfile;

  useEffect(() => {
    if (!canWriteProfile || !boutiqueSearchVisible || !boutiqueItems?.length || !products?.length) {
      return;
    }

    const pendingItems = boutiqueItems.filter((item: any) => !item.is_visible_in_search || !item.product_id);
    if (!pendingItems.length) {
      return;
    }

    const syncKey = pendingItems
      .map((item: any) => `${item.id}:${item.product_id || 'none'}:${item.is_visible_in_search ? 'visible' : 'hidden'}`)
      .join('|');

    if (boutiqueCatalogSyncRef.current === syncKey) {
      return;
    }

    boutiqueCatalogSyncRef.current = syncKey;

    const syncEligibleBoutiqueItems = async () => {
      try {
        const knownProducts = [...(products ?? [])];

        for (const item of pendingItems) {
          const label = String(item.label || '').trim();
          const category = formatProductCategory(item.category || '');
          const unit = String(item.unit || 'pièce').trim() || 'pièce';

          if (!label || !category) {
            continue;
          }

          const existingProduct = knownProducts.find((product: any) => {
            return (
              normalizeProductName(product.name || '') === normalizeProductName(label) &&
              normalizeProductName(product.category || '') === normalizeProductName(category) &&
              normalizeUnit(product.unit || 'unit') === normalizeUnit(unit)
            );
          });

          const linkedProduct =
            existingProduct ||
            (await addProductMutation.mutateAsync({
              name: label,
              category,
              unit,
              image_url: item.image_url || null,
            }));

          if (!existingProduct) {
            knownProducts.push(linkedProduct);
          }

          await supabase
            .from('boutique_items')
            .update({
              product_id: linkedProduct.id,
              is_visible_in_search: true,
            })
            .eq('id', item.id)
            .eq('owner_id', currentUserId);
        }

        queryClient.invalidateQueries({ queryKey: ['boutique-items', currentUserId] });
        queryClient.invalidateQueries({ queryKey: ['boutique-items', 'visible'] });
        queryClient.invalidateQueries({ queryKey: ['searchable-products'] });
        queryClient.invalidateQueries({ queryKey: ['products'] });
      } catch (error) {
        console.warn('[profile:boutique-catalog-sync] failed', {
          message: (error as any)?.message ?? String(error),
        });
      }
    };

    void syncEligibleBoutiqueItems();
  }, [
    addProductMutation,
    boutiqueItems,
    boutiqueSearchVisible,
    canWriteProfile,
    currentUserId,
    products,
    queryClient,
  ]);

  const showAccountSignOut = Boolean(user?.id || (profile?.id && profile.id !== GUEST_ID));

  const displayedBoutiqueItems = useMemo(() => {
    const items = [...(boutiqueItems ?? [])];
    if (boutiqueFilter === 'demand') {
      return items.sort((a: any, b: any) => {
        const demandDifference = (boutiqueProductDemand?.[b.product_id] ?? 0) - (boutiqueProductDemand?.[a.product_id] ?? 0);
        return demandDifference || new Date(b.updated_at ?? b.created_at ?? 0).getTime() - new Date(a.updated_at ?? a.created_at ?? 0).getTime();
      });
    }
    if (boutiqueFilter === 'recent') {
      return items.sort((a: any, b: any) => new Date(b.updated_at ?? b.created_at ?? 0).getTime() - new Date(a.updated_at ?? a.created_at ?? 0).getTime());
    }
    return items;
  }, [boutiqueFilter, boutiqueItems, boutiqueProductDemand]);
  if (isLoading || isLoadingProfile) {
    return null;
  }

  const visibleProfileName = showAccountSignOut
    ? profile?.full_name || user?.email || 'Utilisateur'
    : 'Visiteur';
  const visibleProfileRole = showAccountSignOut ? profile?.role || 'client' : 'visiteur';
  const boutiqueTotalCount = boutiqueItems?.length ?? 0;
  const boutiqueVisibleCount = (boutiqueItems ?? []).filter((item: any) => Boolean(item.is_visible_in_search)).length;
  const boutiqueLinkedCount = (boutiqueItems ?? []).filter((item: any) => Boolean(item.product_id)).length;

  const boutiquePendingCount = Math.max(0, boutiqueTotalCount - boutiqueVisibleCount);
  const accountActionButton = (
    <TouchableOpacity
      activeOpacity={0.82}
      style={[styles.topAccountButton, showAccountSignOut ? styles.topLogoutButton : styles.topLoginButton]}
      onPress={showAccountSignOut ? handleSignOut : () => router.push('/(auth)/login')}
      disabled={showAccountSignOut && isSigningOut}
    >
      <Shield color={Colors.white} size={16} />
      <Typography variant="caption" color={Colors.white} style={{ fontWeight: '900' }}>
        {showAccountSignOut ? (isSigningOut ? 'Déconnexion...' : 'Déconnexion') : 'Se connecter'}
      </Typography>
    </TouchableOpacity>
  );
  const sectionTabs = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.profileTabsScroll}
      contentContainerStyle={styles.profileTabs}
    >
      <TouchableOpacity
        style={[styles.profileTabButton, profileSection === 'boutique' && styles.profileTabButtonActive]}
        onPress={() => { setProfileSection('boutique'); setProfileTab('boutique'); }}
      >
        <Typography
          variant="caption"
          color={profileSection === 'boutique' ? Colors.white : Colors.textSecondary}
          style={styles.profileTabText}
        >
          Boutique
        </Typography>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.profileTabButton, profileSection === 'contributions' && styles.profileTabButtonActive]}
        onPress={() => { setProfileSection('contributions'); setProfileTab('profil'); }}
      >
        <Typography
          variant="caption"
          color={profileSection === 'contributions' ? Colors.white : Colors.textSecondary}
          style={styles.profileTabText}
        >
          Contributions
        </Typography>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.profileTabButton, profileSection === 'recompenses' && styles.profileTabButtonActive]}
        onPress={() => { setProfileSection('recompenses'); setProfileTab('profil'); }}
      >
        <Typography variant="caption" color={profileSection === 'recompenses' ? Colors.white : Colors.textSecondary} style={styles.profileTabText}>
          Récompenses
        </Typography>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.profileTabButton, profileSection === 'activite' && styles.profileTabButtonActive]}
        onPress={() => { setProfileSection('activite'); setProfileTab('profil'); }}
      >
        <Typography variant="caption" color={profileSection === 'activite' ? Colors.white : Colors.textSecondary} style={styles.profileTabText}>
          Activité
        </Typography>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.profileTabButton}
        onPress={() => setSettingsModal(true)}
      >
        <Typography variant="caption" color={Colors.textSecondary} style={styles.profileTabText}>
          Paramètres
        </Typography>
      </TouchableOpacity>
    </ScrollView>
  );

  const profileTopActions = (
    <View style={styles.profileTopActions}>
      <View style={styles.profileTopTitleWrap}>
        <Typography variant="caption" color={Colors.textSecondary} style={styles.profileTopEyebrow}>Mon espace</Typography>
        <Typography variant="h2" numberOfLines={1}>Profil & boutique</Typography>
      </View>
      <View style={styles.profileActionGroup}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ouvrir les messages" style={styles.profileActionButton} onPress={() => router.push('/messages')} activeOpacity={0.82}>
          <MessageCircle size={19} color={Colors.primary} />
          {recentChats.length > 0 ? <View style={styles.profileActionBadge}><Typography variant="caption" color={Colors.white} style={styles.profileActionBadgeText}>{recentChats.length > 9 ? '9+' : recentChats.length}</Typography></View> : null}
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ouvrir les notifications" style={styles.profileActionButton} onPress={() => { setProfileTab('profil'); setProfileSection('activite'); }} activeOpacity={0.82}>
          <BellRing size={19} color={Colors.gold} />
          {dedupedAlerts.length > 0 ? <View style={[styles.profileActionBadge, styles.profileNotificationBadge]}><Typography variant="caption" color={Colors.white} style={styles.profileActionBadgeText}>{dedupedAlerts.length > 9 ? '9+' : dedupedAlerts.length}</Typography></View> : null}
        </TouchableOpacity>
      </View>
    </View>
  );
  if (profileTab === 'boutique') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {profileTopActions}
        <Card style={styles.sellerIdentityCard} variant="outline">
          <View style={styles.sellerIdentityTopRow}>
            <View style={styles.sellerIdentityAvatar}>
              <Typography variant="h2" color={Colors.white}>
                {visibleProfileName[0] || 'V'}
              </Typography>
            </View>
            <View style={{ flex: 1 }}>
              <Typography variant="h2" numberOfLines={1}>
                {visibleProfileName}
              </Typography>
              <Typography variant="caption" color={Colors.textSecondary}>
                {profileCityName} · {visibleProfileRole}
              </Typography>
            </View>
            <View style={styles.sellerTrustPill}>
              <Shield size={13} color={Colors.emerald} />
              <Typography variant="caption" color={Colors.emerald} style={{ fontWeight: '900' }}>
                {resolvedTrustScore}/100
              </Typography>
            </View>
          </View>
          <View style={styles.sellerIdentityStats}>
            <View style={styles.sellerIdentityStat}>
              <Typography variant="body" style={{ fontWeight: '900' }}>{resolvedLevel}</Typography>
              <Typography variant="caption" color={Colors.textSecondary}>Niveau</Typography>
            </View>
            <View style={styles.sellerIdentityStat}>
              <Typography variant="body" style={{ fontWeight: '900' }}>{resolvedPoints}</Typography>
              <Typography variant="caption" color={Colors.textSecondary}>Points</Typography>
            </View>
            <View style={styles.sellerIdentityStat}>
              <Typography variant="body" style={{ fontWeight: '900' }}>{rewardSummary?.priceCount ?? 0}</Typography>
              <Typography variant="caption" color={Colors.textSecondary}>Prix relevés</Typography>
            </View>
          </View>
        </Card>

        {sectionTabs}

        <Animated.View entering={FadeInDown.duration(500)} style={[styles.boutiqueHero, boutiqueSearchVisible && styles.boutiqueHeroActive]}>
          <View style={styles.boutiqueHeroTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color={boutiqueSearchVisible ? Colors.emerald : Colors.gold} style={styles.boutiqueEyebrow}>
                {boutiqueSearchVisible ? 'Vitrine active' : 'Vitrine privée'}
              </Typography>
              <Typography variant="h2" style={styles.boutiqueHeroTitle}>
                Ma boutique
              </Typography>
              <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 4 }}>
                Gère tes produits, leur prix vendeur et leur visibilité dans les recherches.
              </Typography>
            </View>
            <View style={[styles.ruleBadge, boutiqueSearchVisible ? styles.ruleBadgeOk : styles.ruleBadgePending]}>
              <Typography variant="caption" style={styles.ruleBadgeText}>
                {boutiqueSearchVisible ? 'Recherche active' : 'Badge requis'}
              </Typography>
            </View>
          </View>

          <View style={styles.boutiqueStatsGrid}>
            <View style={styles.boutiqueStatCard}>
              <Typography variant="h2" style={styles.boutiqueStatValue}>
                {boutiqueTotalCount}
              </Typography>
              <Typography variant="caption" color={Colors.textSecondary}>Produits</Typography>
            </View>
            <View style={styles.boutiqueStatCard}>
              <Typography variant="h2" style={styles.boutiqueStatValue}>
                {boutiqueVisibleCount}
              </Typography>
              <Typography variant="caption" color={Colors.textSecondary}>Visibilité</Typography>
            </View>
            <View style={styles.boutiqueStatCard}>
              <Typography variant="h2" style={styles.boutiqueStatValue}>
                {boutiqueLinkedCount}
              </Typography>
              <Typography variant="caption" color={Colors.textSecondary}>Catalogue</Typography>
            </View>
          </View>

          <View style={styles.boutiqueStatusStrip}>
            <Info size={16} color={boutiqueSearchVisible ? Colors.emerald : Colors.gold} />
            <Typography variant="caption" color={Colors.textSecondary} style={styles.boutiqueHeroText}>
              {boutiqueSearchVisible
                ? 'Les produits disponibles peuvent afficher “Disponible chez vous” ou “Acheter chez vous” selon ta palette.'
                : `${boutiquePendingCount || boutiqueTotalCount || 0} produit(s) restent en vitrine privée jusqu’au badge fiable ou vérifié.`}
            </Typography>
          </View>
        </Animated.View>

        <Card style={styles.boutiqueCard} variant="outline">
          <View style={styles.businessCardHeader}>
            <View style={[styles.businessIcon, { backgroundColor: Colors.primary + '18' }]}>
              <ShoppingBag color={Colors.primary} size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Typography variant="body" style={{ fontWeight: '800' }}>
                Ajouter un produit boutique
              </Typography>
              <Typography variant="caption" color={Colors.textSecondary}>
                Ce prix reste ton prix vendeur. Le prix marché public reste séparé.
              </Typography>
            </View>
          </View>

          <View style={styles.boutiqueForm}>
            <TextInput
              value={boutiqueLabel}
              onChangeText={setBoutiqueLabel}
              placeholder="Libellé du produit"
              placeholderTextColor={Colors.textSecondary}
              style={styles.boutiqueInput}
            />
            <TextInput
              value={boutiqueCategory}
              onChangeText={setBoutiqueCategory}
              placeholder="Catégorie produit"
              placeholderTextColor={Colors.textSecondary}
              style={styles.boutiqueInput}
            />
            <Typography variant="caption" color={Colors.textSecondary}>
              Tu peux choisir une catégorie existante ou en saisir une nouvelle.
            </Typography>
            <View style={styles.boutiqueFormRow}>
              <TextInput
                value={boutiqueUnit}
                onChangeText={setBoutiqueUnit}
                placeholder="Unité"
                placeholderTextColor={Colors.textSecondary}
                style={[styles.boutiqueInput, styles.boutiqueHalfInput]}
              />
              <TextInput
                value={boutiquePrice}
                onChangeText={setBoutiquePrice}
                placeholder="Prix de vente"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="numeric"
                style={[styles.boutiqueInput, styles.boutiqueHalfInput]}
              />
            </View>
            <TouchableOpacity
              style={styles.photoPickerButton}
              onPress={handlePickBoutiqueImage}
              activeOpacity={0.82}
            >
              {boutiqueImageUrl ? (
                <Image source={{ uri: boutiqueImageUrl }} style={styles.photoPickerPreview} resizeMode="cover" />
              ) : (
                <View style={styles.photoPickerPlaceholder}>
                  <ShoppingBag color={Colors.primary} size={22} />
                </View>
              )}
              <View style={styles.photoPickerCopy}>
                <Typography variant="body" style={{ fontWeight: '800' }}>
                  {boutiqueImageUrl ? 'Modifier la photo' : 'Ajouter une photo'}
                </Typography>
                <Typography variant="caption" color={Colors.textSecondary}>
                  Une image claire améliore la visibilité du produit.
                </Typography>
              </View>
            </TouchableOpacity>
            {editingBoutiqueItemId ? (
              <TouchableOpacity onPress={() => setEditingBoutiqueItemId(null)} style={styles.cancelEditButton} activeOpacity={0.82}>
                <Typography variant="caption" color={Colors.textSecondary} style={{ fontWeight: '800' }}>Annuler la modification</Typography>
              </TouchableOpacity>
            ) : null}
            {editingBoutiqueItemId ? (
              <Typography variant="caption" color={Colors.primary} style={{ fontWeight: '800', marginBottom: 4 }}>
                Modification du produit sélectionné
              </Typography>
            ) : null}
            <Button
              title={addBoutiqueItem.isPending ? 'Ajout...' : 'Ajouter à ma boutique'}
              onPress={handleAddBoutiqueItem}
              loading={addBoutiqueItem.isPending || updateBoutiqueItem.isPending}
              style={{ marginTop: 4 }}
            />
          </View>
        </Card>

        <Card style={styles.boutiqueCard} variant="outline">
          <View style={styles.businessCardHeader}>
            <View style={[styles.businessIcon, { backgroundColor: Colors.gold + '18' }]}>
              <MapPin color={Colors.gold} size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Typography variant="body" style={{ fontWeight: '800' }}>
                Produits en boutique
              </Typography>
              <Typography variant="caption" color={Colors.textSecondary}>
                {boutiqueItems?.length ? 'Les produits ajoutés ici servent à nourrir ta vitrine.' : 'Aucun produit boutique pour le moment.'}
              </Typography>
            </View>
          </View>

          <Typography variant="caption" color={Colors.textSecondary} style={styles.boutiqueFilterLabel}>
            Trier les produits
          </Typography>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.boutiqueFilterRow}>
            {([
              ['all', 'Tous'],
              ['demand', 'Plus consultés'],
              ['recent', 'Mis à jour'],
            ] as const).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                onPress={() => setBoutiqueFilter(value)}
                style={[styles.boutiqueFilterChip, boutiqueFilter === value && styles.boutiqueFilterChipActive]}
                activeOpacity={0.82}
              >
                <Typography
                  variant="caption"
                  color={boutiqueFilter === value ? Colors.white : Colors.textSecondary}
                  style={styles.boutiqueFilterChipText}
                >
                  {label}
                </Typography>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {boutiqueItems?.length ? (
            <View style={styles.boutiqueList}>
              {displayedBoutiqueItems.map((item) => {
                const itemVisible = Boolean(item.is_visible_in_search && boutiqueSearchVisible);
                const itemLinked = Boolean(item.product_id);

                return (
                  <View key={item.id} style={styles.boutiqueItemCard}>
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={styles.boutiqueThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.boutiqueThumb, { backgroundColor: Colors.primary + '18' }]}>
                        <ShoppingBag color={Colors.primary} size={20} />
                      </View>
                    )}

                    <View style={styles.boutiqueItemBody}>
                      <View style={styles.boutiqueItemTopRow}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body" style={{ fontWeight: '900' }} numberOfLines={1}>
                            {item.label}
                          </Typography>
                          <Typography variant="caption" color={Colors.textSecondary} numberOfLines={1}>
                            {item.category} · {item.unit}
                          </Typography>
                        </View>
                        <View style={styles.boutiquePricePill}>
                          <Typography variant="caption" color={Colors.primary} style={{ fontWeight: '900' }}>
                            {typeof item.price_value === 'number' ? `${item.price_value} F` : 'Prix à ajouter'}
                          </Typography>
                        </View>
                      </View>

                      <View style={styles.boutiqueItemMetaRow}>
                        <View style={[styles.ruleBadge, itemVisible ? styles.ruleBadgeOk : styles.ruleBadgePending]}>
                          <Typography variant="caption" style={styles.ruleBadgeText}>
                            {itemVisible ? 'Visible recherche' : 'Vitrine privée'}
                          </Typography>
                        </View>
                        <View style={[styles.ruleBadge, itemLinked ? styles.ruleBadgeOk : undefined]}>
                          <Typography variant="caption" style={styles.ruleBadgeText}>
                            {itemLinked ? 'Catalogue lié' : 'Non publié'}
                          </Typography>
                        </View>
                      </View>

                      <View style={styles.boutiqueItemActions}>
                        <TouchableOpacity style={styles.productActionButton} onPress={() => startEditBoutiqueItem(item)} activeOpacity={0.82}>
                          <Edit2 size={14} color={Colors.primary} />
                          <Typography variant="caption" color={Colors.primary} style={styles.productActionText}>Modifier</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.productActionButton} onPress={() => void toggleBoutiqueVisibility(item)} activeOpacity={0.82}>
                          {item.is_visible_in_search ? <EyeOff size={14} color={Colors.textSecondary} /> : <Eye size={14} color={Colors.emerald} />}
                          <Typography variant="caption" color={Colors.textSecondary} style={styles.productActionText}>
                            {item.is_visible_in_search ? 'Masquer' : 'Publier'}
                          </Typography>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.productActionButton} onPress={() => confirmDeleteBoutiqueItem(item)} activeOpacity={0.82}>
                          <Trash2 size={14} color={Colors.error} />
                          <Typography variant="caption" color={Colors.error} style={styles.productActionText}>Supprimer</Typography>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyStateCard}>
              <Typography variant="caption" color={Colors.textSecondary} style={{ textAlign: 'center' }}>
                Ajoute ton premier produit pour remplir la vitrine boutique.
              </Typography>
            </View>
          )}
        </Card>

        <Card style={styles.boutiqueCard} variant="outline">
          <View style={styles.businessCardHeader}>
            <View style={[styles.businessIcon, { backgroundColor: Colors.emerald + '18' }]}>
              <BellRing color={Colors.emerald} size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Typography variant="body" style={{ fontWeight: '800' }}>
                Activité boutique
              </Typography>
              <Typography variant="caption" color={Colors.textSecondary}>
                Messages client-vendeur et alertes importantes.
              </Typography>
            </View>
          </View>

          <View style={styles.boutiqueActivityTabs}>
            <View style={styles.boutiqueActivityPill}>
              <MessageCircle size={14} color={Colors.primary} />
              <Typography variant="caption" color={Colors.primary} style={{ fontWeight: '800' }}>
                {recentChats.length} message(s)
              </Typography>
            </View>
            <View style={styles.boutiqueActivityPill}>
              <Zap size={14} color={Colors.error} />
              <Typography variant="caption" color={Colors.error} style={{ fontWeight: '800' }}>
                {dedupedAlerts.length} alerte(s)
              </Typography>
            </View>
          </View>

          <TouchableOpacity
            style={styles.messagesShortcut}
            activeOpacity={0.86}
            onPress={() => router.push('/messages')}
          >
            <View style={styles.chatIconWrap}>
              <MessageCircle size={16} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Typography variant="caption" style={{ fontWeight: '900' }}>
                Ouvrir la messagerie
              </Typography>
              <Typography variant="caption" color={Colors.textSecondary} numberOfLines={1}>
                {recentChats.length
                  ? `${recentChats.length} conversation(s) recente(s)`
                  : 'Aucune conversation pour le moment'}
              </Typography>
            </View>
            <View style={styles.chatTimePill}>
              <Typography variant="caption" style={styles.ruleBadgeText}>
                Voir
              </Typography>
            </View>
          </TouchableOpacity>

          {dedupedAlerts.length ? (
            <View style={[styles.boutiqueList, { marginTop: 10 }]}>
              {dedupedAlerts.slice(0, 3).map((alert: any) => (
                <View key={alert.id} style={styles.notificationRow}>
                  <View style={{ flex: 1 }}>
                    <Typography variant="caption" style={{ fontWeight: '800' }}>
                      {alert.title}
                    </Typography>
                    <Typography variant="caption" color={Colors.textSecondary}>
                      {alert.products?.name || 'Produit'} · {alert.markets?.name || 'Marché'}
                    </Typography>
                  </View>
                  <View style={[styles.ruleBadge, styles.ruleBadgePending]}>
                    <Typography variant="caption" style={styles.ruleBadgeText}>
                      P{alert.priority}
                    </Typography>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyStateCard}>
              <Typography variant="caption" color={Colors.textSecondary} style={{ textAlign: 'center' }}>
                Aucune notification boutique pour le moment.
              </Typography>
            </View>
          )}
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {profileTopActions}
      {alertFeedback ? (
        <Card
          style={[
            styles.alertFeedbackCard,
            alertFeedback.tone === 'success'
              ? styles.alertFeedbackSuccess
              : alertFeedback.tone === 'error'
              ? styles.alertFeedbackError
              : styles.alertFeedbackInfo,
          ]}
          variant="outline"
        >
          <View style={styles.inlineRow}>
            <Info
              size={16}
              color={
                alertFeedback.tone === 'success'
                  ? Colors.emerald
                  : alertFeedback.tone === 'error'
                  ? Colors.error
                  : Colors.primary
              }
            />
            <Typography
              variant="caption"
              color={
                alertFeedback.tone === 'success'
                  ? Colors.emerald
                  : alertFeedback.tone === 'error'
                  ? Colors.error
                  : Colors.primary
              }
              style={{ flex: 1, fontWeight: '800' }}
            >
              {alertFeedback.message}
            </Typography>
            <TouchableOpacity onPress={() => setAlertFeedback(null)}>
              <X size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </Card>
      ) : null}

      <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Typography variant="h1" color={Colors.white}>
              {visibleProfileName[0] || 'V'}
            </Typography>
          </View>
          <TouchableOpacity style={styles.editBadge} onPress={openEdit}>
            <Edit2 size={14} color={Colors.white} />
          </TouchableOpacity>
        </View>

        <Typography variant="h1" style={styles.name} numberOfLines={1}>
          {visibleProfileName}
        </Typography>

        {isDemoSellerProfile ? (
          <View style={styles.demoProfileBanner}>
            <Shield size={12} color={Colors.gold} />
            <Typography variant="caption" style={styles.demoProfileBannerText}>
              Profil vendeur de démonstration
            </Typography>
          </View>
        ) : null}

        <View style={styles.badgeRow}>
          <View style={[styles.tag, { backgroundColor: Colors.primary + '20' }]}>
            <Award size={12} color={Colors.primary} />
            <Typography variant="caption" color={Colors.primary} style={{ marginLeft: 4 }}>
              Niveau {resolvedLevel}
            </Typography>
          </View>
          <View style={[styles.tag, { backgroundColor: Colors.emerald + '20' }]}>
            <Zap size={12} color={Colors.emerald} />
            <Typography variant="caption" color={Colors.emerald} style={{ marginLeft: 4 }}>
              {resolvedPoints} pts
            </Typography>
          </View>
          <View style={[styles.tag, { backgroundColor: Colors.gold + '20' }]}>
            <Typography variant="caption" color={Colors.text} style={{ marginLeft: 4 }}>
              {visibleProfileRole}
            </Typography>
          </View>
        </View>

        <Typography variant="body" color={Colors.textSecondary} style={styles.bio}>
          {profile?.bio || 'Aucune bio definie.'}
        </Typography>

        {sectionTabs}

        <Card style={styles.profileIntegrityCard} variant="outline">
          <View style={styles.profileIntegrityHeader}>
            <View>
              <Typography variant="label" color={Colors.primary}>
                Données fiables
              </Typography>
              <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 4 }}>
                On affiche les valeurs calculées serveur et la position enregistrée la plus récente.
              </Typography>
            </View>
            <View style={[styles.ruleBadge, hasFreshSavedLocation ? styles.ruleBadgeOk : styles.ruleBadgePending]}>
              <Typography variant="caption" style={styles.ruleBadgeText}>
                {profileLocationStatus}
              </Typography>
            </View>
          </View>

          <View style={styles.profileIntegrityGrid}>
            <View style={styles.profileIntegrityItem}>
              <Typography variant="caption" color={Colors.textSecondary}>
                Ville
              </Typography>
              <Typography variant="body" style={{ fontWeight: '800' }}>
                {profileCityName}
              </Typography>
            </View>
            <View style={styles.profileIntegrityItem}>
              <Typography variant="caption" color={Colors.textSecondary}>
                Marché lié
              </Typography>
              <Typography variant="body" style={{ fontWeight: '800' }}>
                {savedPreferredMarket?.name || 'non défini'}
              </Typography>
            </View>
            <View style={styles.profileIntegrityItem}>
              <Typography variant="caption" color={Colors.textSecondary}>
                Score fiabilité
              </Typography>
              <Typography variant="body" style={{ fontWeight: '800' }}>
                {resolvedTrustScore}/100
              </Typography>
            </View>
            <View style={styles.profileIntegrityItem}>
              <Typography variant="caption" color={Colors.textSecondary}>
                Dernière position
              </Typography>
              <Typography variant="body" style={{ fontWeight: '800' }}>
                {profile?.last_location_verified_at ? formatTimeAgo(profile.last_location_verified_at) : 'Jamais'}
              </Typography>
            </View>
          </View>
        </Card>
      </Animated.View>

      <View style={styles.statsRow}>
        <Animated.View entering={FadeInRight.delay(200)} style={{ flex: 1 }}>
          <Card style={styles.statCard} variant="elevated">
            <Typography variant="h2" color={Colors.primary}>
              {rewardSummary?.priceCount ?? (stats?.priceCount || 0)}
            </Typography>
            <Typography variant="label">Prix saisis</Typography>
          </Card>
        </Animated.View>
        <Animated.View entering={FadeInRight.delay(400)} style={{ flex: 1 }}>
          <Card style={styles.statCard} variant="outline">
            <Typography variant="h2" color={Colors.primary}>
              {confirmedAlertsCount}
            </Typography>
            <Typography variant="label">Confirmations</Typography>
          </Card>
        </Animated.View>
      </View>

      <Card style={styles.miniStatCard} variant="outline">
        <Typography variant="caption" color={Colors.textSecondary}>
          Corrections proposees
        </Typography>
        <Typography variant="h2" color={Colors.primary}>
          {correctedAlertsCount}
        </Typography>
      </Card>

      <Card style={styles.profileDetailsSummary} variant="outline">
        <View style={styles.profileDetailsSummaryHeader}>
          <View style={{ flex: 1 }}>
            <Typography variant="label" color={Colors.primary}>
              Règles métier en bref
            </Typography>
            <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 4 }}>
              Les conditions d’accès, badges et historique sont repliés pour garder le profil lisible.
            </Typography>
          </View>
          <Button
            title={showDetailedProfile ? 'Masquer' : 'Voir tout'}
            variant="secondary"
            onPress={() => setShowDetailedProfile((value) => !value)}
          />
        </View>
      </Card>

      {showDetailedProfile ? (
        <>
          <Typography variant="h2" style={styles.sectionTitle}>
            Règles métier
          </Typography>

          <View style={styles.businessGrid}>
            <Card style={styles.businessCard} variant="outline">
          <View style={styles.businessCardHeader}>
            <View style={[styles.businessIcon, { backgroundColor: isSellerProfile ? Colors.primary + '18' : Colors.emerald + '18' }]}>
              <MapPin color={isSellerProfile ? Colors.primary : Colors.emerald} size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Typography variant="body" style={{ fontWeight: '800' }}>
                {isSellerProfile ? 'Accès marché vendeur' : 'Ticket client'}
              </Typography>
              <Typography variant="caption" color={Colors.textSecondary}>
                {isSellerProfile
                  ? 'Les vendeurs doivent prouver leur activité avant d’être mis en avant.'
                  : 'Les tickets récompensent les clients réguliers et utiles.'}
              </Typography>
            </View>
          </View>

          {isSellerProfile ? (
            <View style={styles.paletteStack}>
              <View style={[styles.paletteCard, styles.paletteReliable]}>
                <View style={styles.paletteHeader}>
                  <View style={[styles.businessIcon, { backgroundColor: Colors.emerald + '18' }]}>
                    <Shield color={Colors.emerald} size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Typography variant="body" style={{ fontWeight: '800' }}>
                      Palette 1 - Fiable
                    </Typography>
                    <Typography variant="caption" color={Colors.textSecondary}>
                      Accès marché via l’activité, la fiabilité et le classement local.
                    </Typography>
                  </View>
                  <View style={[styles.ruleBadge, sellerAccessEligible ? styles.ruleBadgeOk : styles.ruleBadgePending]}>
                    <Typography variant="caption" style={styles.ruleBadgeText}>
                      {sellerAccessEligible ? 'Ouvert' : 'Bloqué'}
                    </Typography>
                  </View>
                </View>

                <View style={styles.paletteChipsRow}>
                  <View style={styles.paletteChip}>
                    <Typography variant="caption" color={Colors.emerald} style={styles.ruleBadgeText}>
                      Badge fiable
                    </Typography>
                  </View>
                  <View style={styles.paletteChip}>
                    <Typography variant="caption" color={Colors.textSecondary} style={styles.ruleBadgeText}>
                      Top 100 zone
                    </Typography>
                  </View>
                </View>

                <Typography variant="caption" color={Colors.textSecondary} style={styles.paletteText}>
                  Visible dans les recherches seulement si un vendeur confirmé et éligible a déclaré ce produit.
                  Sinon, rien n’apparaît au public.
                </Typography>
              </View>

              <View style={[styles.paletteCard, styles.paletteVerified]}>
                <View style={styles.paletteHeader}>
                  <View style={[styles.businessIcon, { backgroundColor: Colors.gold + '18' }]}>
                    <Award color={Colors.gold} size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Typography variant="body" style={{ fontWeight: '800' }}>
                      Palette 2 - Vérifié
                    </Typography>
                    <Typography variant="caption" color={Colors.textSecondary}>
                      Badge vérifié + fiable, visibilité renforcée et services premium.
                    </Typography>
                  </View>
                  <View style={[styles.ruleBadge, verifiedSellerAccess ? styles.ruleBadgeOk : styles.ruleBadgePending]}>
                    <Typography variant="caption" style={styles.ruleBadgeText}>
                      {verifiedSellerAccess ? 'Actif' : 'À acheter'}
                    </Typography>
                  </View>
                </View>

                <View style={styles.paletteChipsRow}>
                  <View style={styles.paletteChip}>
                    <Typography variant="caption" color={Colors.gold} style={styles.ruleBadgeText}>
                      Badge vérifié
                    </Typography>
                  </View>
                  <View style={styles.paletteChip}>
                    <Typography variant="caption" color={Colors.textSecondary} style={styles.ruleBadgeText}>
                      Top 100 auto
                    </Typography>
                  </View>
                </View>

                <Typography variant="caption" color={Colors.textSecondary} style={styles.paletteText}>
                  Ouvre la messagerie client-vendeur, les propositions de livraison et la mise en avant boutique.
                  Dans les recherches, le bouton ouvre le lien vendeur confirmé.
                </Typography>
              </View>

              <View style={styles.ruleList}>
                {sellerAccessCriteria.map((criterion) => (
                  <View key={criterion.id} style={styles.ruleRow}>
                    <View style={styles.ruleRowText}>
                      <Typography variant="caption" style={styles.ruleRowTitle}>
                        {criterion.label}
                      </Typography>
                      <Typography variant="caption" color={Colors.textSecondary}>
                        {criterion.details}
                      </Typography>
                    </View>
                    <View style={[styles.ruleBadge, criterion.achieved ? styles.ruleBadgeOk : styles.ruleBadgePending]}>
                      <Typography variant="caption" style={styles.ruleBadgeText}>
                        {criterion.achieved ? 'OK' : 'À faire'}
                      </Typography>
                    </View>
                  </View>
                ))}

                <View style={styles.ruleFooter}>
                  <Typography variant="caption" color={Colors.textSecondary}>
                    Classement local
                  </Typography>
                  <Typography variant="caption" style={styles.ruleFooterValue}>
                    {sellerZoneRank ? `#${sellerZoneRank} / 100` : 'Hors top 100'}
                  </Typography>
                </View>
                <View style={styles.ruleFooter}>
                  <Typography variant="caption" color={Colors.textSecondary}>
                    Couverture actuelle
                  </Typography>
                  <Typography variant="caption" style={styles.ruleFooterValue}>
                    {recentMarketCount} marché(s) récent(s)
                  </Typography>
                </View>
              </View>
              {!verifiedSellerAccess ? (
                <Button
                  title="Acheter le badge vérifié"
                  variant="outline"
                  onPress={handleBuyVerifiedBadge}
                  style={styles.verifiedBadgeButton}
                />
              ) : (
                <View style={styles.verifiedBadgeActive}>
                  <Typography variant="caption" color={Colors.gold} style={{ fontWeight: '800' }}>
                    Badge vérifié actif
                  </Typography>
                  <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 2 }}>
                    Palette 2 ouverte, top 100 automatique et avantages premium visibles.
                  </Typography>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.ruleList}>
              {clientTicketRoadmap.map((ticket) => (
                <View key={ticket.id} style={styles.ruleRow}>
                  <View style={styles.ruleRowText}>
                    <Typography variant="caption" style={styles.ruleRowTitle}>
                      {ticket.title}
                    </Typography>
                    <Typography variant="caption" color={Colors.textSecondary}>
                      {ticket.details}
                    </Typography>
                  </View>
                  <View style={[styles.ruleBadge, ticket.achieved ? styles.ruleBadgeOk : styles.ruleBadgePending]}>
                    <Typography variant="caption" style={styles.ruleBadgeText}>
                      {ticket.achieved
                        ? 'Débloqué'
                        : `${Math.max(0, (ticket.points ?? 0) - (rewardSummary?.totalPoints || 0))} pts`}
                    </Typography>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card style={styles.businessCard} variant="outline">
          <View style={styles.businessCardHeader}>
            <View style={[styles.businessIcon, { backgroundColor: Colors.gold + '18' }]}>
              <Award color={Colors.gold} size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Typography variant="body" style={{ fontWeight: '800' }}>
                Badges
              </Typography>
              <Typography variant="caption" color={Colors.textSecondary}>
                Les seuils sont transparents: on sait exactement ce qu’il faut pour progresser.
              </Typography>
            </View>
          </View>

          <View style={styles.ruleList}>
            {badgeRoadmap.map((badge) => (
              <View key={badge.id} style={styles.ruleRow}>
                <View style={styles.ruleRowText}>
                  <Typography variant="caption" style={styles.ruleRowTitle}>
                    {badge.title}
                  </Typography>
                  <Typography variant="caption" color={Colors.textSecondary}>
                    {badge.details}
                  </Typography>
                </View>
                <View style={[styles.ruleBadge, badge.achieved ? styles.ruleBadgeOk : styles.ruleBadgePending]}>
                  <Typography variant="caption" style={styles.ruleBadgeText}>
                    {badge.achieved ? 'Obtenu' : 'À débloquer'}
                  </Typography>
                </View>
              </View>
            ))}
          </View>
        </Card>
      </View>
        </>
      ) : null}

      <Typography variant="h2" style={styles.sectionTitle}>
        Mon impact
      </Typography>

      <Card style={styles.rewardHero} variant="elevated">
        <View style={styles.rewardHeroHeader}>
          <View>
            <Typography variant="body" style={{ fontWeight: '800' }}>
              {rewardGoal.title}
            </Typography>
            <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 4 }}>
              {rewardGoal.description}
            </Typography>
          </View>
          <View style={[styles.iconWrap, { backgroundColor: Colors.primary + '15' }]}>
            <ShoppingBag color={Colors.primary} size={18} />
          </View>
        </View>

        <View style={styles.rewardProgressTrack}>
          <View
            style={[
              styles.rewardProgressFill,
              { width: `${Math.max(8, Math.round((rewardSummary?.progressToNextLevel ?? 0) * 100))}%` },
            ]}
          />
        </View>

        <View style={styles.rewardMetaRow}>
          <Typography variant="caption" color={Colors.textSecondary}>
            Score fiabilite
          </Typography>
          <Typography variant="caption" color={Colors.primary} style={{ fontWeight: '800' }}>
            {resolvedTrustScore}/100
          </Typography>
        </View>

        <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 10 }}>
          {rewardGoal.unlock}
        </Typography>
      </Card>

      <View style={styles.rewardStatGrid}>
        <Card style={styles.rewardStatCard} variant="outline">
          <Typography variant="caption" color={Colors.textSecondary}>
            Points utiles
          </Typography>
          <Typography variant="h2" color={Colors.primary}>
            {resolvedPoints}
          </Typography>
        </Card>
        <Card style={styles.rewardStatCard} variant="outline">
          <Typography variant="caption" color={Colors.textSecondary}>
            Prochain niveau
          </Typography>
          <Typography variant="h2" color={Colors.primary}>
            {rewardSummary ? Math.max(0, rewardSummary.nextLevelAt - rewardSummary.totalPoints) : 80}
          </Typography>
        </Card>
      </View>

      {rewardSummary?.breakdown?.length ? (
        <Card style={styles.rewardBreakdown} variant="outline">
          {rewardSummary.breakdown.map((entry) => (
            <View key={entry.label} style={styles.rewardRow}>
              <Typography variant="caption" color={Colors.textSecondary}>
                {entry.label}
              </Typography>
              <Typography variant="caption" color={Colors.primary} style={{ fontWeight: '800' }}>
                +{entry.value}
              </Typography>
            </View>
          ))}
        </Card>
      ) : null}

      {showDetailedProfile ? (
        <>
      {zoneLeaderboard?.length ? (
        <>
          <Typography variant="h2" style={styles.sectionTitle}>
            Classement local
          </Typography>
          <Card style={styles.rewardBreakdown} variant="outline">
            {zoneLeaderboard.map((entry: any) => (
              <View key={entry.userId} style={styles.rewardRow}>
                <View>
                  <Typography variant="caption" style={{ fontWeight: '800' }}>
                    #{entry.rank} {entry.fullName}
                  </Typography>
                  <Typography variant="caption" color={Colors.textSecondary}>
                    {entry.priceCount} prix • {entry.confirmedCount} confirmations
                  </Typography>
                </View>
                <Typography variant="caption" color={Colors.primary} style={{ fontWeight: '800' }}>
                  {entry.score} pts
                </Typography>
              </View>
            ))}
          </Card>
        </>
      ) : null}
      </>
    ) : null}

      <Typography variant="h2" style={styles.sectionTitle}>
        A confirmer pres de vous
      </Typography>

      <View style={styles.alertSection}>
        <Card style={styles.alertSummary} variant="outline">
          <View style={styles.menuRow}>
            <View style={[styles.iconWrap, { backgroundColor: Colors.gold + '20' }]}>
              <BellRing color={Colors.gold} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Typography variant="body" style={{ fontWeight: '700' }}>
                {dedupedAlerts.length} alertes actives
              </Typography>
              <Typography variant="caption" color={Colors.textSecondary}>
                Zone: {cities?.find((city: any) => city.id === profile?.city_id)?.name || 'non definie'} · role: {profile?.role || 'client'}
              </Typography>
              {targetMarket?.name ? (
                <Typography variant="caption" color={Colors.textSecondary} style={styles.gpsHint}>
                    Marché cible : {targetMarket.name}
                </Typography>
              ) : null}
              {profile?.last_location_verified_at ? (
                <Typography variant="caption" color={Colors.textSecondary} style={styles.gpsHint}>
                  Position enregistrée {hasFreshSavedLocation ? 'récente' : 'à réactualiser'}
                  {savedPreferredMarket?.name ? ` · ${savedPreferredMarket.name}` : ''}
                </Typography>
              ) : null}
              {zoneDetectionState === 'detecting' ? (
                <Typography variant="caption" color={Colors.primary} style={styles.gpsHint}>
                  Detection automatique de votre zone...
                </Typography>
              ) : null}
              {zoneDetectionState === 'permission_denied' ? (
                <Typography variant="caption" color={Colors.error} style={styles.gpsHint}>
                  Autorisez la localisation pour detecter votre zone.
                </Typography>
              ) : null}
              {zoneDetectionState === 'not_found' ? (
                <Typography variant="caption" color={Colors.textSecondary} style={styles.gpsHint}>
                  Zone introuvable automatiquement pour le moment.
                </Typography>
              ) : null}
            </View>
          </View>
        </Card>

        {visibleAlerts.length ? (
          visibleAlerts.map((alert: any, index: number) => (
            <Animated.View key={alert.id} entering={FadeInRight.delay(index * 100)}>
              <Card style={styles.alertCard} variant="default">
                <View style={styles.alertHeader}>
                  <View style={{ flex: 1 }}>
                    <Typography variant="label" color={Colors.primary}>
                      {alert.title}
                    </Typography>
                    <Typography variant="body" style={{ marginTop: 4, fontWeight: '700' }}>
                      {alert.products?.name || 'Produit'} · {alert.markets?.name || 'Marché'}
                    </Typography>
                  </View>
                  <View style={styles.priorityBadge}>
                    <Typography variant="caption" color={Colors.white} style={{ fontWeight: '800' }}>
                      P{alert.priority}
                    </Typography>
                  </View>
                </View>

                <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 8 }}>
                  {alert.message}
                </Typography>

                <View style={styles.alertGuidanceBox}>
                  <Typography variant="caption" color={Colors.primary} style={{ fontWeight: '800' }}>
                    {getAlertActionGuidance(alert.alert_type)}
                  </Typography>
                </View>

                <View style={styles.priceMeta}>
                  <Typography variant="caption" color={Colors.textSecondary}>
                    Prix actuel
                  </Typography>
                  <Typography variant="body" color={Colors.primary} style={{ fontWeight: '800' }}>
                    {alert.current_price ? `${Math.round(alert.current_price).toLocaleString()} F` : '--'}
                  </Typography>
                </View>

                <View style={styles.alertActions}>
                  {alertActionIndex.get(`${alert.id}:confirmed`) ? (
                    <View style={styles.doneChip}>
                      <CheckCircle2 size={12} color={Colors.emerald} />
                      <Typography variant="caption" color={Colors.emerald} style={{ marginLeft: 6, fontWeight: '800' }}>
                        Deja confirme
                      </Typography>
                    </View>
                  ) : null}
                  {alertActionIndex.get(`${alert.id}:updated_price`) ? (
                    <View style={styles.doneChip}>
                      <CheckCircle2 size={12} color={Colors.primary} />
                      <Typography variant="caption" color={Colors.primary} style={{ marginLeft: 6, fontWeight: '800' }}>
                        Correction envoyee
                      </Typography>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.alertActionBtn, styles.alertActionPrimary]}
                    onPress={() => handleConfirm(alert)}
                    disabled={!session || actOnAlert.isPending || !!alertActionIndex.get(`${alert.id}:confirmed`)}
                  >
                    <CheckCircle2 size={14} color={Colors.white} />
                    <Typography variant="caption" color={Colors.white} style={{ marginLeft: 6, fontWeight: '800' }}>
                      {actOnAlert.isPending ? 'Validation...' : 'Confirmer'}
                    </Typography>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.alertActionBtn, styles.alertActionSecondary]}
                    onPress={() => openCorrection(alert)}
                    disabled={!session || !!alertActionIndex.get(`${alert.id}:updated_price`)}
                  >
                    <Typography variant="caption" color={Colors.primary} style={{ fontWeight: '800' }}>
                      Corriger
                    </Typography>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.alertActionBtn}
                    onPress={async () => {
                      try {
                        await actOnAlert.mutateAsync({
                          alertId: alert.id,
                          userId: user?.id || currentUserId,
                          actionType: 'dismissed',
                        });
                        setAlertFeedback({
                          tone: 'info',
                          message: 'Alerte mise de cote. Elle quittera votre file de verification.',
                        });
                      } catch (error: any) {
                        setAlertFeedback({
                          tone: 'error',
                          message: error.message || 'Impossible de reporter cette alerte.',
                        });
                      }
                    }}
                    disabled={!session || actOnAlert.isPending || !!alertActionIndex.get(`${alert.id}:dismissed`)}
                  >
                    <X size={14} color={Colors.textSecondary} />
                    <Typography
                      variant="caption"
                      color={Colors.textSecondary}
                      style={{ marginLeft: 6, fontWeight: '800' }}
                    >
                      Plus tard
                    </Typography>
                  </TouchableOpacity>
                </View>
              </Card>
            </Animated.View>
          ))
        ) : (
          <Card style={styles.emptyBadges} variant="outline">
            <Typography variant="caption" color={Colors.textSecondary}>
              Aucune alerte active pour le moment.
            </Typography>
          </Card>
        )}
      </View>

      <Typography variant="h2" style={styles.sectionTitle}>
        Ma Progression (Badges)
      </Typography>

      <View style={styles.badgeGrid}>
        {userBadges && userBadges.length > 0 ? (
          userBadges.map((userBadge: any, index: number) => {
            const Icon = badgeIcons[userBadge.badges.icon_name] || Award;
            return (
              <Animated.View key={userBadge.id} entering={FadeInRight.delay(index * 100)}>
                <Card style={styles.badgeItem} variant="elevated">
                  <View style={styles.badgeIconWrap}>
                    <Icon color={Colors.primary} size={24} />
                  </View>
                  <Typography variant="caption" style={{ fontWeight: '800', marginTop: 8 }}>
                    {userBadge.badges.name}
                  </Typography>
                </Card>
              </Animated.View>
            );
          })
        ) : (
          <Card style={styles.emptyBadges} variant="outline">
            <Typography variant="caption" color={Colors.textSecondary}>
              Ajoutez votre premier prix pour debloquer le badge Pionnier.
            </Typography>
          </Card>
        )}
      </View>

      <Typography variant="h2" style={styles.sectionTitle}>
        Activité et paramètres
      </Typography>

      {showDetailedProfile ? (
        <>
          <Card style={styles.menuItem}>
            <View style={styles.menuRow}>
              <View style={[styles.iconWrap, { backgroundColor: Colors.textSecondary + '10' }]}>
                <History color={Colors.textSecondary} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="body" style={{ fontWeight: '600' }}>
                  Historique de mes prix
                </Typography>
                <Typography variant="caption" color={Colors.textSecondary}>
                  Vos derniers relevés, en lecture simple.
                </Typography>
              </View>
            </View>

            <View style={styles.historyList}>
              {historyEntries.length ? (
                historyEntries.slice(0, 12).map((entry: any) => (
                  <TouchableOpacity key={entry.id} style={styles.historyRow} onPress={() => setSelectedHistoryEntry(entry)}>
                    <View style={{ flex: 1 }}>
                      <Typography variant="caption" style={{ fontWeight: '800' }}>
                        {entry.products?.name || 'Produit'}
                      </Typography>
                      <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 2 }}>
                        {entry.markets?.name || 'Marché'} • {formatTimeAgo(entry.created_at)}
                      </Typography>
                    </View>
                    <View style={styles.historyMeta}>
                      <Typography variant="caption" color={Colors.primary} style={{ fontWeight: '800' }}>
                        {formatPrice(Math.round(Number(entry.price_value || 0)))} F
                      </Typography>
                      <Typography variant="label" color={Colors.textSecondary} style={styles.historyScoreText}>
                        {entry.quantity} {entry.products?.unit || 'u'}
                      </Typography>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Typography variant="caption" color={Colors.textSecondary}>
                  Aucun relevé pour le moment.
                </Typography>
              )}
            </View>
          </Card>
        </>
      ) : null}

      <TouchableOpacity onPress={() => setSettingsModal(true)}>
        <Card style={styles.menuItem}>
          <View style={styles.menuRow}>
            <View style={[styles.iconWrap, { backgroundColor: Colors.textSecondary + '10' }]}>
              <Settings color={Colors.textSecondary} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Typography variant="body" style={{ fontWeight: '600' }}>
                Paramètres du compte
              </Typography>
              <Typography variant="caption" color={Colors.textSecondary}>
                Notifications, confidentialité et préférences à définir.
              </Typography>
            </View>
            <Typography variant="caption" color={Colors.primary} style={{ fontWeight: '800' }}>
              Ouvrir
            </Typography>
          </View>
        </Card>
      </TouchableOpacity>

      {!session ? <Button title="Se connecter" onPress={() => router.push('/(auth)/login')} style={styles.loginBtn} /> : null}

      <PriceCorrectionModal
        visible={correctionModal}
        alert={selectedAlert}
        correctedPrice={correctedPrice}
        onChangePrice={setCorrectedPrice}
        onCancel={() => {
          setCorrectionModal(false);
          setSelectedAlert(null);
          setCorrectedPrice('');
        }}
        onSubmit={handleCorrection}
        isPending={addPrice.isPending}
      />

      <HistoryDetailModal
        entry={selectedHistoryEntry}
        onClose={() => setSelectedHistoryEntry(null)}
      />

      <EditProfileModal
        visible={editModal}
        onClose={() => setEditModal(false)}
        name={newName}
        onChangeName={setNewName}
        bio={newBio}
        onChangeBio={setNewBio}
        role={newRole}
        onChangeRole={setNewRole}
        cityId={newCityId}
        onChangeCityId={setNewCityId}
        cities={cities ?? []}
        isDetectingZone={isDetectingZone}
        zoneDetectionState={zoneDetectionState}
        zoneDetectionDebug={zoneDetectionDebug}
        onDetectCity={handleDetectProfileCity}
        onSave={handleUpdate}
      />

      <SettingsModal
        visible={settingsModal}
        onClose={() => setSettingsModal(false)}
        showAccountSignOut={showAccountSignOut}
        isSigningOut={isSigningOut}
        onSignOut={handleSignOut}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Layout.tabScreenBottomPadding,
    width: '100%',
  },
  alertFeedbackCard: {
    marginBottom: 12,
  },
  alertFeedbackSuccess: {
    borderColor: Colors.emerald + '55',
    backgroundColor: Colors.emerald + '10',
  },
  alertFeedbackError: {
    borderColor: Colors.error + '55',
    backgroundColor: Colors.error + '10',
  },
  alertFeedbackInfo: {
    borderColor: Colors.primary + '55',
    backgroundColor: Colors.primary + '10',
  },
  header: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.soft,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.emerald,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  name: {
    marginBottom: 8,
  },
  profileTopActions: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 16,
  },
  profileTopTitleWrap: { flex: 1, minWidth: 0 },
  profileTopEyebrow: { textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '800', marginBottom: 2 },
  profileActionGroup: { flexDirection: 'row', gap: 8, marginLeft: 12 },
  profileActionButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, position: 'relative' },
  profileActionBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderWidth: 2, borderColor: Colors.background },
  profileNotificationBadge: { backgroundColor: Colors.gold },
  profileActionBadgeText: { fontSize: 10, lineHeight: 12, fontWeight: '900' },
  profileTabs: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
    padding: 4,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    flexGrow: 1,
  },
  profileTabsScroll: {
    width: '100%',
    alignSelf: 'stretch',
  },
  profileTabButton: {
    minWidth: 104,
    paddingVertical: 8,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  profileTabButtonActive: {
    backgroundColor: Colors.primary,
    ...Shadows.soft,
  },
  profileTabText: {
    fontWeight: '800',
    fontSize: 12,
  },
  sellerIdentityCard: {
    marginBottom: 14,
    padding: 14,
  },
  sellerIdentityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sellerIdentityAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  sellerTrustPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.emerald + '14',
    flexShrink: 1,
  },
  sellerIdentityStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  sellerIdentityStat: {
    flex: 1,
    padding: 9,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  boutiqueHero: {
    gap: 14,
    padding: 18,
    borderRadius: Radius.xl,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  boutiqueHeroActive: {
    borderColor: Colors.emerald + '45',
    backgroundColor: Colors.emerald + '08',
  },
  boutiqueHeroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  boutiqueEyebrow: {
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  boutiqueHeroTitle: {
    fontSize: 28,
    fontWeight: '900',
  },
  boutiqueHeroText: {
    flex: 1,
    lineHeight: 19,
  },
  boutiqueStatsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  boutiqueStatCard: {
    flex: 1,
    minWidth: 0,
    padding: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  boutiqueStatValue: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.primary,
  },
  boutiqueStatusStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  boutiqueCard: {
    marginBottom: 14,
  },
  boutiqueForm: {
    gap: 10,
  },
  boutiqueFormRow: {
    flexDirection: 'row',
    gap: 10,
  },
  boutiqueInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    color: Colors.text,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  boutiqueHalfInput: {
    flex: 1,
  },
  photoPickerButton: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  photoPickerPreview: {
    width: 62,
    height: 62,
    borderRadius: Radius.sm,
  },
  photoPickerPlaceholder: {
    width: 62,
    height: 62,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary + '45',
  },
  photoPickerCopy: {
    flex: 1,
    gap: 4,
  },
  boutiqueList: {
    gap: 10,
    marginTop: 12,
  },
  boutiqueFilterRow: {
    gap: 8,
    paddingBottom: 2,
  },
  boutiqueFilterLabel: {
    marginTop: 12,
    marginBottom: 8,
    fontWeight: '800',
  },
  boutiqueFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  boutiqueFilterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  boutiqueFilterChipText: {
    fontWeight: '800',
  },
  boutiqueItemCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: Radius.xl,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  boutiqueThumb: {
    width: 58,
    height: 58,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  boutiqueItemBody: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  boutiqueItemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  boutiquePricePill: {
    maxWidth: 112,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary + '12',
    borderWidth: 1,
    borderColor: Colors.primary + '25',
  },
  boutiqueItemMetaRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  boutiqueItemActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    paddingTop: 2,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  productActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingRight: 6,
  },
  productActionText: { fontWeight: '800', fontSize: 12 },
  cancelEditButton: { alignSelf: 'flex-start', paddingVertical: 6 },
  boutiqueActivityTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 2,
  },
  boutiqueActivityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messagesShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary + '10',
    borderWidth: 1,
    borderColor: Colors.primary + '25',
    marginTop: 10,
  },
  chatIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary + '14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatTimePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary + '10',
  },
  emptyStateCard: {
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  demoProfileBanner: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.gold + '14',
    borderWidth: 1,
    borderColor: Colors.gold + '30',
  },
  demoProfileBannerText: {
    fontWeight: '800',
    color: Colors.gold,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  bio: {
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  topAccountButton: {
    minHeight: 48,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    ...Shadows.soft,
  },
  topLogoutButton: {
    backgroundColor: Colors.error,
  },
  topLoginButton: {
    backgroundColor: Colors.primary,
  },
  profileIntegrityCard: {
    width: '100%',
    alignSelf: 'stretch',
    marginTop: 6,
    marginBottom: 12,
    padding: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
  },
  profileIntegrityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  profileIntegrityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  profileIntegrityItem: {
    width: '48%',
    padding: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 2,
  },
  profileDetailsSummary: {
    marginBottom: 18,
    padding: 16,
    borderRadius: Radius.lg,
    backgroundColor: Colors.white,
  },
  profileDetailsSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  miniStatCard: {
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 18,
  },
  rewardHero: {
    paddingVertical: 18,
    marginBottom: 14,
  },
  rewardHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  rewardProgressTrack: {
    height: 10,
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
    overflow: 'hidden',
    marginTop: 16,
  },
  rewardProgressFill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  rewardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  rewardStatGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  rewardStatCard: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  rewardBreakdown: {
    marginBottom: 18,
  },
  rewardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  sectionTitle: {
    marginBottom: 16,
    marginTop: 8,
  },
  businessGrid: {
    gap: 12,
    marginBottom: 18,
  },
  businessCard: {
    padding: 14,
    gap: 12,
  },
  businessCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  businessIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteStack: {
    gap: 12,
  },
  paletteCard: {
    padding: 14,
    borderRadius: Radius.md,
    gap: 10,
  },
  paletteReliable: {
    backgroundColor: Colors.emerald + '08',
    borderWidth: 1,
    borderColor: Colors.emerald + '1A',
  },
  paletteVerified: {
    backgroundColor: Colors.gold + '08',
    borderWidth: 1,
    borderColor: Colors.gold + '1A',
  },
  paletteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paletteChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paletteChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paletteText: {
    lineHeight: 18,
  },
  ruleList: {
    gap: 10,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  ruleRowText: {
    flex: 1,
    minWidth: 0,
  },
  ruleRowTitle: {
    fontWeight: '800',
  },
  ruleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    flexShrink: 1,
  },
  ruleBadgeOk: {
    backgroundColor: Colors.emerald + '18',
  },
  ruleBadgePending: {
    backgroundColor: Colors.gold + '18',
  },
  ruleBadgeText: {
    fontWeight: '800',
  },
  ruleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  ruleFooterValue: {
    fontWeight: '800',
    color: Colors.primary,
  },
  verifiedBadgeButton: {
    marginTop: 4,
  },
  verifiedBadgeActive: {
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.gold + '10',
    borderWidth: 1,
    borderColor: Colors.gold + '25',
  },
  alertSection: {
    gap: 12,
    marginBottom: 24,
  },
  alertSummary: {
    paddingVertical: 16,
  },
  alertCard: {
    paddingVertical: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.gold,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  priorityBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  alertActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  alertGuidanceBox: {
    marginTop: 10,
    backgroundColor: Colors.primary + '10',
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  alertActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.background,
  },
  alertActionPrimary: {
    backgroundColor: Colors.primary,
  },
  alertActionSecondary: {
    backgroundColor: Colors.primary + '12',
  },
  doneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  priceMeta: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuItem: {
    marginBottom: 12,
    paddingVertical: 16,
  },
  settingsLogoutButton: {
    minHeight: 64,
    borderRadius: Radius.md,
    backgroundColor: Colors.error,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Shadows.soft,
  },
  settingsLoginButton: {
    backgroundColor: Colors.primary,
  },
  historyList: {
    marginTop: 16,
    gap: 14,
  },
  historyGroup: {
    gap: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  historyMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  historyScoreText: {
    marginTop: 2,
    fontSize: 10,
  },
  historyDetailGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 16,
  },
  settingsList: {
    gap: 12,
  },
  settingsItem: {
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  settingsItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsHint: {
    alignSelf: 'flex-start',
    fontWeight: '800',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBtn: {
    marginTop: 30,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    paddingBottom: Layout.screenBottomPadding,
  },
  settingsModalContent: {
    maxHeight: '88%',
  },
  settingsModalBody: {
    paddingBottom: Layout.screenBottomPadding,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 30,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  cityList: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  detectCityButton: {
    minHeight: 58,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...Shadows.soft,
  },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  choiceChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  gpsHint: {
    marginTop: 10,
    fontWeight: '800',
  },
  zoneDebugText: {
    marginTop: 8,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    fontFamily: 'monospace',
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  badgeItem: {
    width: (screenWidth - 60) / 3,
    alignItems: 'center',
    padding: 12,
  },
  badgeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBadges: {
    width: '100%',
    padding: 20,
    alignItems: 'center',
  },
});


