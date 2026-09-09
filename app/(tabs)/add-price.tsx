import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import * as Location from 'expo-location';
import { ArrowLeft, CheckCircle2, ChevronRight, Info, MapPin, Plus, Search, X, Zap } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useToast } from '@/components/ToastProvider';
import { Typography } from '@/components/Typography';
import { useAuth } from '@/libs/auth';
import { formatProductCategory, normalizePricePerBaseUnit, normalizeProductName } from '@/libs/normalization';
import {
  useAddPrice,
  useAddProduct,
  useCities,
  useExternalSourceHealth,
  useLatestPrice,
  useMarkets,
  useProductMarketIntelligence,
  useProducts,
  useProfile,
  useUpdateProfile,
} from '@/libs/queries';
import { validatePrice } from '@/libs/validation';
import { supabase } from '@/libs/supabase';
import { Colors, Layout, Radius, Shadows, Spacing } from '@/constants/Theme';

const CATEGORY_ICONS: Record<string, string> = {
  Cereales: '🌾',
  Fruits: '🍎',
  Epicerie: '🫘',
  Viandes: '🥩',
  Legumes: '🥬',
  Boissons: '🥤',
  Menage: '🧼',
  Construction: '🏗️',
  Boutique: '🛍️',
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return r * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const matchesCityName = (candidate: string, cityName: string) => {
  const normalizedCandidate = candidate.trim().toLowerCase();
  const normalizedCity = cityName.trim().toLowerCase();

  return (
    normalizedCandidate === normalizedCity ||
    normalizedCandidate.includes(normalizedCity) ||
    normalizedCity.includes(normalizedCandidate)
  );
};

const LOCATION_REFRESH_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export default function AddPriceScreen() {
  const { session, user, isLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { q } = useLocalSearchParams<{ q?: string | string[] }>();
  const { showToast } = useToast();

  const { data: products, isLoading: isLoadingProducts, error: errorProducts } = useProducts();
  const { data: markets, isLoading: isLoadingMarkets, error: errorMarkets } = useMarkets();
  const { data: cities } = useCities();
  const { data: profile } = useProfile(user?.id || '');
  const updateProfile = useUpdateProfile();
  const addPriceMutation = useAddPrice();
  const addProductMutation = useAddProduct();

  const [step, setStep] = useState(0);
  const [selectedMarket, setSelectedMarket] = useState<any | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [quantityInput, setQuantityInput] = useState('1');
  const [validation, setValidation] = useState<{ isAnomaly: boolean; reason?: string } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('');
  const [newProductUnit, setNewProductUnit] = useState('kg');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackTone, setFeedbackTone] = useState<'error' | 'success' | 'info'>('info');
  const [showValidationReview, setShowValidationReview] = useState(false);
  const [locationState, setLocationState] = useState<'idle' | 'requesting' | 'blocked' | 'ready'>('idle');
  const [locationHelp, setLocationHelp] = useState('');
  const [detectedCityId, setDetectedCityId] = useState('');
  const [detectedCityName, setDetectedCityName] = useState('');
  const [selectedMarketName, setSelectedMarketName] = useState('');
  const [selectedMarketDistance, setSelectedMarketDistance] = useState('');
  const [locationDebug, setLocationDebug] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const locationHydrationKeyRef = useRef<string | null>(null);
  const parsedPriceValue = useMemo(() => parseInt(priceInput, 10), [priceInput]);
  const parsedQuantityValue = useMemo(() => parseFloat(quantityInput || '1'), [quantityInput]);
  const isPriceEntryValid =
    Number.isFinite(parsedPriceValue) &&
    parsedPriceValue > 0 &&
    Number.isFinite(parsedQuantityValue) &&
    parsedQuantityValue > 0;

  const { data: latestPriceInfo } = useLatestPrice(selectedProduct?.id, selectedMarket?.id);
  const { data: intelligence } = useProductMarketIntelligence(selectedProduct?.id, selectedMarket?.id);
  const { data: externalSourceHealth } = useExternalSourceHealth();

  const savedLocationIsFresh = useMemo(() => {
    if (!profile?.last_location_verified_at) {
      return false;
    }

    const verifiedAt = Date.parse(profile.last_location_verified_at);
    if (!Number.isFinite(verifiedAt)) {
      return false;
    }

    return Date.now() - verifiedAt < LOCATION_REFRESH_INTERVAL_MS;
  }, [profile?.last_location_verified_at]);

  const savedMarket = useMemo(() => {
    if (!profile?.preferred_market_id) {
      return null;
    }

    return (markets ?? []).find((market: any) => market.id === profile.preferred_market_id) ?? null;
  }, [markets, profile?.preferred_market_id]);

  const detectedCity = useMemo(() => {
    const cityId = detectedCityId || profile?.city_id || savedMarket?.city_id || '';
    if (!cityId) {
      return null;
    }

    return (cities ?? []).find((city: any) => city.id === cityId) ?? null;
  }, [cities, detectedCityId, profile?.city_id, savedMarket?.city_id]);

  const detectedCityMarket = useMemo(() => {
    const cityId = detectedCityId || profile?.city_id || savedMarket?.city_id || '';
    if (selectedMarket) {
      return selectedMarket;
    }

    if (!cityId) {
      return savedMarket ?? null;
    }

    return (markets ?? []).find((market: any) => market.city_id === cityId) ?? savedMarket ?? null;
  }, [detectedCityId, markets, profile?.city_id, savedMarket, selectedMarket]);

  const persistDetectedLocationToProfile = async (input: {
    cityId?: string | null;
    market?: any | null;
    latitude?: number | null;
    longitude?: number | null;
    detectedAt?: string | null;
  }) => {
    if (!user?.id || !input.cityId) {
      if (input.cityId && !user?.id) {
        setFeedbackTone('info');
        setFeedbackMessage('Ville détectée, mais connectez-vous pour la garder sur votre profil.');
        showToast({
          tone: 'info',
          title: 'Connexion requise',
          message: 'La ville est détectée pour ce relevé, mais elle ne peut pas être persistée sans session.',
        });
      }
      return false;
    }

    try {
      const locationPayload = {
        city_id: input.cityId,
        preferred_market_id: input.market?.id || profile?.preferred_market_id || null,
        last_location_latitude: input.latitude ?? profile?.last_location_latitude ?? null,
        last_location_longitude: input.longitude ?? profile?.last_location_longitude ?? null,
        last_location_verified_at: input.detectedAt ?? profile?.last_location_verified_at ?? new Date().toISOString(),
      };

      await updateProfile.mutateAsync({
        id: user.id,
        full_name: profile?.full_name,
        phone: profile?.phone,
        role: profile?.role,
        bio: profile?.bio,
        avatar_url: profile?.avatar_url,
        ...locationPayload,
      });

      const { data: refreshedProfile, error: refreshError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (refreshError) {
        throw refreshError;
      }

      const persistedCityId = refreshedProfile?.city_id ?? null;
      const persistedMarketId = refreshedProfile?.preferred_market_id ?? null;
      const cityPersisted = persistedCityId === locationPayload.city_id;
      const marketPersisted =
        !locationPayload.preferred_market_id || persistedMarketId === locationPayload.preferred_market_id;

      if (!cityPersisted || !marketPersisted) {
        const { data: fallbackProfile, error: fallbackError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            full_name: refreshedProfile?.full_name ?? profile?.full_name ?? user.email?.split('@')[0] ?? 'Utilisateur',
            phone: refreshedProfile?.phone ?? profile?.phone ?? null,
            role: refreshedProfile?.role ?? profile?.role ?? 'client',
            bio: refreshedProfile?.bio ?? profile?.bio ?? null,
            avatar_url: refreshedProfile?.avatar_url ?? profile?.avatar_url ?? null,
            ...locationPayload,
          })
          .select()
          .single();

        if (fallbackError) {
          throw fallbackError;
        }

        queryClient.setQueryData(['profile', user.id], fallbackProfile);
        await queryClient.invalidateQueries({ queryKey: ['profile', user.id] });

        if (__DEV__) {
          console.log('[add-price:location-persist]', {
            mode: 'fallback-upsert',
            cityId: fallbackProfile?.city_id ?? null,
            preferredMarketId: fallbackProfile?.preferred_market_id ?? null,
          });
        }

        return true;
      }

      queryClient.setQueryData(['profile', user.id], refreshedProfile);
      await queryClient.invalidateQueries({ queryKey: ['profile', user.id] });

      if (__DEV__) {
        console.log('[add-price:location-persist]', {
          mode: 'profile-update',
          cityId: refreshedProfile?.city_id ?? null,
          preferredMarketId: refreshedProfile?.preferred_market_id ?? null,
        });
      }

      return true;
    } catch (persistError) {
      console.warn('[add-price] unable to persist detected profile city', persistError);
      setFeedbackTone('error');
      setFeedbackMessage('Ville détectée, mais impossible de l’enregistrer sur le profil.');
      showToast({
        tone: 'error',
        title: 'Profil non mis à jour',
        message: 'La ville a été détectée, mais son rattachement au profil a échoué.',
      });
      return false;
    }
  };

  const handleUseDetectedCity = async () => {
    const cityId = detectedCityId || detectedCityMarket?.city_id || profile?.city_id || savedMarket?.city_id || '';

    if (detectedCityMarket) {
      setSelectedMarket(detectedCityMarket);
    }

    if (detectedCity?.name) {
      setDetectedCityId(cityId);
      setDetectedCityName(detectedCity.name);
      setLocationHelp(
        detectedCityMarket?.name ? `${detectedCity.name} · ${detectedCityMarket.name}` : detectedCity.name
      );
    }

    const persisted = await persistDetectedLocationToProfile({
      cityId,
      market: detectedCityMarket,
    });

    if (persisted) {
      showToast({
        tone: 'success',
        title: 'Profil mis à jour',
        message: detectedCity?.name
          ? `${detectedCity.name} est maintenant rattachée à ton profil.`
          : 'La ville détectée est rattachée à ton profil.',
      });
    }

    setStep(1);
  };

  useEffect(() => {
    const nextQuery = Array.isArray(q) ? q[0] : q;
    if (nextQuery && !searchQuery) {
      setSearchQuery(nextQuery);
    }
  }, [q, searchQuery]);

  useEffect(() => {
    if (!isLoading && !session) {
      router.push('/(auth)/login');
    }
  }, [isLoading, router, session]);

  useEffect(() => {
    if (!selectedProduct || !priceInput) {
      setValidation(null);
      return;
    }

    const nextPrice = parseFloat(priceInput);
    const nextQuantity = parseFloat(quantityInput || '1');
    if (!nextPrice || !nextQuantity || !intelligence?.localNormalizedPrices?.length) {
      setValidation(null);
      return;
    }

    const normalizedInput = normalizePricePerBaseUnit(nextPrice, selectedProduct.unit || 'unit', nextQuantity).normalizedPrice;
    setValidation(validatePrice(normalizedInput, intelligence.localNormalizedPrices));
  }, [intelligence, priceInput, quantityInput, selectedProduct]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    scrollRef.current?.scrollTo({ y: 0, animated: true });

    const timeout = setTimeout(() => {
      setSuccessMessage('');
    }, 5000);

    return () => clearTimeout(timeout);
  }, [successMessage]);

  useEffect(() => {
    if (!feedbackMessage) {
      return;
    }

    scrollRef.current?.scrollTo({ y: 0, animated: true });

    const timeout = setTimeout(() => {
      setFeedbackMessage('');
    }, 5000);

    return () => clearTimeout(timeout);
  }, [feedbackMessage]);

  useEffect(() => {
    if (!profile || !markets?.length || !cities?.length) {
      return;
    }

    const syncKey = [
      profile.id,
      profile.city_id || '',
      profile.preferred_market_id || '',
      profile.last_location_verified_at || '',
    ].join('|');

    if (locationHydrationKeyRef.current === syncKey) {
      return;
    }

    if (savedLocationIsFresh && savedMarket) {
      const marketCity = (cities ?? []).find((city: any) => city.id === savedMarket.city_id || city.id === profile.city_id);
      locationHydrationKeyRef.current = syncKey;
      setSelectedMarket(savedMarket);
      setDetectedCityId(profile.city_id || savedMarket.city_id || '');
      setDetectedCityName(marketCity?.name || '');
      setSelectedMarketName(savedMarket.name);
      setSelectedMarketDistance('Enregistré');
      setLocationState('ready');
      setLocationHelp(marketCity?.name ? `${marketCity.name} · ${savedMarket.name}` : savedMarket.name);

      if (step === 0) {
        setStep(1);
      }
      return;
    }

    if (profile.last_location_verified_at && !savedLocationIsFresh) {
      locationHydrationKeyRef.current = syncKey;
      void detectNearestMarket();
    }
  }, [cities, markets, profile, savedLocationIsFresh, savedMarket, step]);

  const searchableProducts = useMemo(() => {
    return (products ?? []).map((product: any) => ({
      ...product,
      source: 'catalog',
      resolvedProductId: product.id,
      boutiqueItemId: null,
    }));
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!searchableProducts.length) return [];
    const normalizedTerm = normalizeProductName(searchQuery);
    const filtered = searchableProducts.filter((product: any) => {
      const haystack = [
        product.name,
        product.category,
        product.unit,
        product.price_value != null ? String(product.price_value) : '',
      ]
        .map((value) => normalizeProductName(String(value || '')))
        .join(' ');

      return !normalizedTerm || haystack.includes(normalizedTerm);
    });
    if (__DEV__ && normalizedTerm && !filtered.length && searchableProducts.length) {
      console.warn('[add-price] search miss', {
        query: searchQuery,
        normalizedTerm,
        availableCount: searchableProducts.length,
        sources: searchableProducts.reduce((acc: Record<string, number>, product: any) => {
          const key = product.source || 'catalog';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {}),
      });
    }
    return filtered;
  }, [searchQuery, searchableProducts]);

  const visibleProducts = useMemo(() => {
    if (searchQuery) {
      return filteredProducts;
    }

    if (!selectedCategory || selectedCategory === 'all') {
      return searchableProducts;
    }

    const normalizedSelectedCategory = normalizeProductName(selectedCategory);
    return searchableProducts.filter((product: any) => normalizeProductName(product.category || '') === normalizedSelectedCategory);
  }, [filteredProducts, searchQuery, searchableProducts, selectedCategory]);

  const categoryOptions = useMemo(() => {
    const categories = new Map<string, string>();

    Object.keys(CATEGORY_ICONS).forEach((category) => {
      categories.set(normalizeProductName(category), category);
    });

    searchableProducts.forEach((product: any) => {
      const formatted = formatProductCategory(product.category || '');
      if (formatted) {
        categories.set(normalizeProductName(formatted), formatted);
      }
    });

    return Array.from(categories.values()).sort((a, b) => a.localeCompare(b));
  }, [searchableProducts]);

  const handleUseCustomCategory = () => {
    const formatted = formatProductCategory(customCategoryInput);
    if (!formatted) {
      showToast({
        tone: 'info',
        title: 'Catégorie requise',
        message: 'Entre un nom de catégorie valide.',
      });
      return;
    }

    setSelectedCategory(formatted);
    setNewProductCategory(formatted);
    setCustomCategoryInput('');
  };

  const unitPrice = useMemo(() => {
    const p = parseFloat(priceInput);
    const q = parseFloat(quantityInput);
    if (!p || !q) return 0;
    return Math.round(p / q);
  }, [priceInput, quantityInput]);

  const priceSignal = useMemo(() => {
    if (!selectedProduct || !priceInput || !quantityInput) return null;

    const totalPrice = parseFloat(priceInput);
    const quantity = parseFloat(quantityInput);
    if (!totalPrice || !quantity) return null;

    const normalizedInput = normalizePricePerBaseUnit(totalPrice, selectedProduct.unit || 'unit', quantity).normalizedPrice;
    const snapshot = intelligence?.snapshot;
    const localAverage = snapshot?.averagePrice ?? null;
    const externalAverage = snapshot?.externalAveragePrice ?? null;

    return {
      localGapPercent: localAverage ? ((normalizedInput - localAverage) / localAverage) * 100 : null,
      externalGapPercent: externalAverage ? ((normalizedInput - externalAverage) / externalAverage) * 100 : null,
      confidenceScore: snapshot?.confidenceScore ?? 0,
      status: snapshot?.status ?? 'insufficient_data',
      validationResult: validation,
    };
  }, [intelligence, priceInput, quantityInput, selectedProduct, validation]);

  const validationHelper = useMemo(() => {
    if (!priceSignal) {
      return null;
    }

    if (priceSignal.validationResult?.isAnomaly) {
      return {
        tone: 'error' as const,
        title: 'Vérification manuelle recommandée',
        text: priceSignal.validationResult.reason || 'Ce prix s’éloigne des relevés récents.',
      };
    }

    if (priceSignal.validationResult?.reason === 'Pas assez de données') {
      return {
        tone: 'info' as const,
        title: 'Peu d historique disponible',
        text: 'Ce relevé aidera à construire une meilleure référence locale.',
      };
    }

    return {
      tone: 'success' as const,
      title: 'Prix exploitable',
      text: 'Le relevé reste cohérent avec les données disponibles.',
    };
  }, [priceSignal]);

  const externalSourceLabel = useMemo(() => {
    if (!externalSourceHealth || externalSourceHealth.mode === 'unknown') {
      return null;
    }

    if (externalSourceHealth.mode === 'ai_web_search') {
      return {
        tone: 'success' as const,
        text: 'Référence web alimentée par l’IA.',
      };
    }

    return {
      tone: 'info' as const,
      text: 'Référence web en mode secours via sources publiques. L’IA est temporairement indisponible.',
    };
  }, [externalSourceHealth]);

  const getBrowserLocation = () =>
    new Promise<Location.LocationObject>((resolve, reject) => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.geolocation ||
        typeof navigator.geolocation.getCurrentPosition !== 'function'
      ) {
        reject(new Error('browser_geolocation_unavailable'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              altitude: position.coords.altitude ?? null,
              accuracy: position.coords.accuracy ?? null,
              altitudeAccuracy: position.coords.altitudeAccuracy ?? null,
              heading: position.coords.heading ?? null,
              speed: position.coords.speed ?? null,
            },
            timestamp: position.timestamp,
          });
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    });

  const getCurrentLocationStrict = async () => {
    if (Platform.OS === 'web') {
      try {
        setLocationDebug('web:navigator.geolocation');
        return await getBrowserLocation();
      } catch {
        setLocationDebug('web:navigator.geolocation failed, expo-location fallback');
        // Fall back to Expo's location module below.
      }
    }

    const { status } = await Location.getForegroundPermissionsAsync();
    setLocationDebug(`expo-location permission=${status}`);
    const permissionStatus = status === 'granted' ? status : (await Location.requestForegroundPermissionsAsync()).status;
    setLocationDebug(`expo-location requested=${permissionStatus}`);

    if (permissionStatus !== 'granted') {
      throw new Error('permission_denied');
    }

    return Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      mayShowUserSettingsDialog: true,
    });
  };

  const findNearestMarket = (latitude: number, longitude: number, sourceMarkets: any[]) => {
    let nearest: any = null;
    let minDistance = Infinity;

    sourceMarkets.forEach((market: any) => {
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

  const findNearestCityFromMarkets = (latitude: number, longitude: number, sourceMarkets: any[]) => {
    const marketsByCity = new Map<string, any[]>();

    sourceMarkets.forEach((market: any) => {
      if (!market.city_id || typeof market.latitude !== 'number' || typeof market.longitude !== 'number') {
        return;
      }

      const current = marketsByCity.get(market.city_id) ?? [];
      current.push(market);
      marketsByCity.set(market.city_id, current);
    });

    let bestCityId: string | null = null;
    let bestDistance = Infinity;
    let bestCityMarkets: any[] = [];

    marketsByCity.forEach((cityMarkets, cityId) => {
      const centroid = cityMarkets.reduce(
        (acc, market) => {
          acc.latitude += market.latitude;
          acc.longitude += market.longitude;
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

  const MAX_CITY_MATCH_DISTANCE_KM = 25;

  const detectNearestMarket = async () => {
    setIsLoadingLocation(true);
    setLocationHelp('');
    setDetectedCityId('');
    setDetectedCityName('');
    setSelectedMarketName('');
    setSelectedMarketDistance('');
    setLocationDebug(null);
    try {
      setLocationState('requesting');
      const location = await getCurrentLocationStrict();
      const { latitude, longitude } = location.coords;
      setLocationState('ready');
      setLocationDebug((prev) => (prev ? `${prev} | coords=${latitude.toFixed(4)},${longitude.toFixed(4)}` : `coords=${latitude.toFixed(4)},${longitude.toFixed(4)}`));

      const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
      const geocodedNames = geocoded
        .flatMap((item) => [item.city, item.subregion, item.region, item.district])
        .filter(Boolean)
        .map((value) => String(value));

      let matchedCity = (cities ?? []).find((city: any) =>
        geocodedNames.some((name) => matchesCityName(name, city.name))
      );

      const allMarkets = (markets ?? []).filter(
        (market: any) => typeof market.latitude === 'number' && typeof market.longitude === 'number'
      );

      let cityMarkets = matchedCity
        ? allMarkets.filter((market: any) => market.city_id === matchedCity.id)
        : [];

      if (!matchedCity || !cityMarkets.length) {
        const fallbackCity = findNearestCityFromMarkets(latitude, longitude, allMarkets);
        const fallbackCityData = fallbackCity.cityId ? (cities ?? []).find((city: any) => city.id === fallbackCity.cityId) : null;

        if (
          fallbackCityData &&
          fallbackCity.cityMarkets.length &&
          Number.isFinite(fallbackCity.distanceKm) &&
          fallbackCity.distanceKm <= MAX_CITY_MATCH_DISTANCE_KM
        ) {
          matchedCity = fallbackCityData;
          cityMarkets = fallbackCity.cityMarkets;
          setLocationDebug((prev) => (prev ? `${prev} | fallback=city-centroid` : 'fallback=city-centroid'));
        }
      }

      if (!matchedCity) {
        throw new Error('city_not_found');
      }

      const cityCentroid = cityMarkets.reduce(
        (acc: { latitude: number; longitude: number }, market: any) => {
          acc.latitude += market.latitude;
          acc.longitude += market.longitude;
          return acc;
        },
        { latitude: 0, longitude: 0 }
      );
      const centroidDistanceKm = calculateDistance(
        latitude,
        longitude,
        cityCentroid.latitude / cityMarkets.length,
        cityCentroid.longitude / cityMarkets.length
      );

      if (!Number.isFinite(centroidDistanceKm) || centroidDistanceKm > MAX_CITY_MATCH_DISTANCE_KM) {
        throw new Error('city_too_far');
      }

      if (!cityMarkets.length) {
        throw new Error('market_not_found');
      }

      const { nearest, minDistance } = findNearestMarket(latitude, longitude, cityMarkets);

      if (nearest) {
        const detectedAt = new Date().toISOString();
        setSelectedMarket(nearest);
        setStep(1);
        const distanceText =
          Number.isFinite(minDistance) && minDistance > 0
            ? minDistance < 1
              ? `${Math.round(minDistance * 1000)} m`
              : `${minDistance.toFixed(1)} km`
            : null;
        setDetectedCityId(matchedCity.id);
        setDetectedCityName(matchedCity.name);
        setSelectedMarketName(nearest.name);
        setSelectedMarketDistance(distanceText || '');
        setLocationHelp(distanceText ? `${matchedCity.name} · ${nearest.name} (${distanceText})` : `${matchedCity.name} · ${nearest.name}`);

        await persistDetectedLocationToProfile({
          cityId: matchedCity.id,
          market: nearest,
          latitude,
          longitude,
          detectedAt,
        });

        showToast({
          tone: 'success',
          title: 'Ville détectée',
          message: distanceText
            ? `${matchedCity.name} · ${nearest.name} (${distanceText})`
            : `${matchedCity.name} · ${nearest.name}`,
        });
        Alert.alert(
          'Ville détectée',
          distanceText
            ? `${matchedCity.name} · ${nearest.name} (${distanceText})`
            : `${matchedCity.name} · ${nearest.name}`
        );
      } else {
        throw new Error('market_not_found');
      }
    } catch (error: any) {
      const errorKey = String(error?.message || error?.code || '');
      const permissionDenied =
        errorKey === 'permission_denied' ||
        errorKey === 'browser_geolocation_unavailable' ||
        errorKey.toLowerCase().includes('denied') ||
        errorKey.toLowerCase().includes('permission');
      const message = permissionDenied
        ? Platform.OS === 'web'
          ? 'La géolocalisation du navigateur doit être autorisée pour ajouter un prix.'
          : 'La géolocalisation est indispensable pour ajouter un prix. Autorisez l’accès à la position.'
        : errorKey === 'city_not_found'
          ? 'Impossible d’identifier votre ville. On a essayé un fallback via les marchés disponibles.'
          : errorKey === 'city_too_far'
            ? 'Votre position semble trop éloignée de la ville détectée. Vérifiez que le GPS est correct.'
          : errorKey === 'market_not_found'
            ? 'Aucun marché n’est enregistré dans la ville détectée.'
          : 'Impossible de récupérer votre position. Vérifiez le GPS et réessayez.';

      setLocationState('blocked');
      setLocationHelp(message);
      setDetectedCityId('');
      setDetectedCityName('');
      setSelectedMarketName('');
      setSelectedMarketDistance('');
      setStep(0);
      locationHydrationKeyRef.current = null;
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      setLocationDebug((prev) => {
        const prefix = prev ? `${prev} | ` : '';
        return `${prefix}error=${errorKey}`;
      });

      showToast({
        tone: permissionDenied ? 'info' : 'error',
        title: permissionDenied ? 'Position requise' : 'Erreur GPS',
        message,
      });

      setFeedbackTone(permissionDenied ? 'info' : 'error');
      setFeedbackMessage(message);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const openLocationSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      setFeedbackTone('info');
      setFeedbackMessage('Ouvrez les paramètres de votre appareil pour autoriser la localisation.');
    }
  };

  const handleAddProduct = async () => {
    const productName = newProductName.trim();
    const productUnit = newProductUnit.trim();
    const categorySource = newProductCategory || (selectedCategory === 'all' ? '' : selectedCategory) || '';
    const productCategory = formatProductCategory(categorySource);

    if (!productName || !productCategory || !productUnit) {
      setFeedbackTone('error');
      setFeedbackMessage('Ajoutez un nom, une catégorie et une unité valides.');
      showToast({
        tone: 'error',
        title: 'Informations incomplètes',
        message: 'Ajoutez un nom, une catégorie et une unité valides.',
      });
      Alert.alert('Informations incomplètes', 'Ajoutez un nom, une catégorie et une unité valides.');
      return;
    }

    try {
      const product = await addProductMutation.mutateAsync({
        name: productName,
        category: productCategory,
        unit: productUnit,
      });
      setSelectedProduct(product);
      setShowNewProductModal(false);
      setNewProductName('');
      setNewProductCategory('');
      setFeedbackTone('success');
      setFeedbackMessage(`Produit ${product.name} ajouté.`);
      showToast({
        tone: 'success',
        title: 'Produit ajouté',
        message: `${product.name} est maintenant disponible.`,
      });
      setStep(2);
    } catch (error: any) {
      setFeedbackTone('error');
      setFeedbackMessage(error.message || 'Création du produit impossible.');
      showToast({
        tone: 'error',
        title: 'Création impossible',
        message: error.message || 'Création du produit impossible.',
      });
      Alert.alert('Erreur', error.message || 'Création du produit impossible.');
    }
  };

  const submitPrice = async () => {
    if (!selectedProduct || !selectedMarket || !user?.id) return;

    if (!detectedCityId || selectedMarket.city_id !== detectedCityId) {
      const message = 'Le marché sélectionné ne correspond pas à la ville détectée. Recalibrez le GPS puis réessayez.';
      setFeedbackTone('error');
      setFeedbackMessage(message);
      showToast({
        tone: 'error',
        title: 'Ville incohérente',
        message,
      });
      Alert.alert('Ville incohérente', message);
      return;
    }

    if (!isPriceEntryValid) {
      setFeedbackTone('error');
      setFeedbackMessage('Le prix et la quantité doivent être supérieurs à zéro.');
      showToast({
        tone: 'error',
        title: 'Valeurs invalides',
        message: 'Le prix et la quantité doivent être supérieurs à zéro.',
      });
      Alert.alert('Valeurs invalides', 'Le prix et la quantité doivent être supérieurs à zéro.');
      return;
    }

    try {
      await addPriceMutation.mutateAsync({
        product_id: selectedProduct.id,
        price_value: parsedPriceValue,
        quantity: parsedQuantityValue,
        market_id: selectedMarket.id,
        recorded_by: user.id,
      });
      setSuccessMessage(`Le prix de ${selectedProduct.name} a bien été ajouté pour ${selectedMarket.name}.`);
      setFeedbackTone('success');
      setFeedbackMessage(`Relevé enregistré pour ${selectedProduct.name} à ${selectedMarket.name}.`);
      showToast({
        tone: 'success',
        title: 'Relevé enregistré',
        message: `${selectedProduct.name} a bien été ajouté pour ${selectedMarket.name}.`,
      });
      resetForm();
      Alert.alert('Succès', 'Relevé enregistré avec succès.', [{ text: 'OK', onPress: () => resetForm() }]);
    } catch (error: any) {
      const message = error.message || 'Enregistrement impossible.';
      setFeedbackTone('error');
      setFeedbackMessage(message);
      showToast({
        tone: 'error',
        title: message.includes('deja avoir ete envoye') ? 'Doublon détecté' : 'Enregistrement impossible',
        message,
        durationMs: 4200,
      });
        Alert.alert(
          message.includes('deja avoir ete envoye')
          ? 'Doublon détecté'
          : 'Erreur',
        message
      );
    }
  };

  const handleSubmit = async () => {
    if (validation?.isAnomaly) {
      setShowValidationReview(true);
      return;
    }

    await submitPrice();
  };

  const resetForm = () => {
    setStep(0);
    setSelectedMarket(null);
    setSelectedProduct(null);
    setSelectedCategory(null);
    setSearchQuery('');
    setPriceInput('');
    setQuantityInput('1');
    setNewProductName('');
    setNewProductCategory('');
    setNewProductUnit('kg');
    setCustomCategoryInput('');
    setValidation(null);
    setLocationState('idle');
    setLocationHelp('');
    setDetectedCityId('');
    setDetectedCityName('');
    setSelectedMarketName('');
    setSelectedMarketDistance('');
    setLocationDebug(null);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Typography variant="body" style={{ marginTop: 10 }}>
          Restauration de votre session...
        </Typography>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.container, styles.centered, { padding: 24 }]}>
        <Card variant="elevated" style={{ width: '100%', padding: 24 }}>
          <Typography variant="h2" style={{ textAlign: 'center' }}>
            Connexion requise
          </Typography>
          <Typography variant="body" color={Colors.textSecondary} style={{ textAlign: 'center', marginTop: 12 }}>
            Connectez-vous pour enregistrer un relevé, créer un produit ou ajouter un nouveau marché.
          </Typography>
          <Button title="Se connecter" onPress={() => router.push('/(auth)/login')} style={{ marginTop: 20 }} />
        </Card>
      </View>
    );
  }

  if (isLoadingProducts || isLoadingMarkets) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Typography variant="body" style={{ marginTop: 10 }}>
          Préparation du formulaire...
        </Typography>
      </View>
    );
  }

  const queryError = (errorProducts || errorMarkets) as any;
  if (queryError) {
    return (
      <View style={[styles.container, styles.centered, { padding: 40 }]}>
        <Typography variant="h2" color={Colors.error}>
          Chargement impossible
        </Typography>
        <Typography variant="body" style={{ textAlign: 'center', marginTop: 10, color: Colors.textSecondary }}>
          {queryError?.message || 'Impossible de charger les données.'}
        </Typography>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        {feedbackMessage ? (
          <Animated.View
            entering={FadeInDown.duration(250)}
            style={[
              styles.feedbackBanner,
              feedbackTone === 'success'
                ? styles.feedbackSuccess
                : feedbackTone === 'error'
                ? styles.feedbackError
                : styles.feedbackInfo,
            ]}
          >
            <Typography variant="body" color={Colors.white} style={{ fontWeight: '700', flex: 1 }}>
              {feedbackMessage}
            </Typography>
            <TouchableOpacity onPress={() => setFeedbackMessage('')}>
              <X size={18} color={Colors.white} />
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        {successMessage ? (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.successBanner}>
            <View style={styles.successIcon}>
              <CheckCircle2 size={18} color={Colors.emerald} />
            </View>
            <Typography variant="body" color={Colors.white} style={{ fontWeight: '700', flex: 1 }}>
              {successMessage}
            </Typography>
            <TouchableOpacity onPress={() => setSuccessMessage('')}>
              <X size={18} color={Colors.white} />
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        <View style={styles.stepsRow}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={[styles.stepDot, step >= index && styles.stepDotActive]} />
          ))}
        </View>

        {step === 0 && (
          <Animated.View entering={FadeInDown.duration(500)} style={styles.stepContainer}>
            <Typography variant="h1" style={styles.title}>
              Où êtes-vous ?
            </Typography>
            <Typography variant="body" color={Colors.textSecondary} style={styles.subtitle}>
              La position est obligatoire pour détecter automatiquement le marché.
            </Typography>

            <View style={styles.gpsStatusCard}>
              <View style={styles.gpsStatusRow}>
                <View style={styles.gpsIcon}>
                  <MapPin size={18} color={Colors.white} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Typography variant="body" style={{ fontWeight: '700' }}>
                    Localisation requise
                  </Typography>
                  <Typography variant="caption" color={Colors.textSecondary}>
                    Activez le GPS pour détecter le marché le plus proche.
                  </Typography>
                </View>
              </View>

              {locationHelp ? (
                <View style={styles.gpsHelpBox}>
                  <Typography variant="caption" color={Colors.textSecondary}>
                    {locationHelp}
                  </Typography>
                </View>
              ) : null}

              {detectedCityName || selectedMarketName ? (
                <TouchableOpacity style={styles.premiumCityBtn} onPress={handleUseDetectedCity} activeOpacity={0.88}>
                  <View style={styles.premiumCityTopRow}>
                    <View style={styles.premiumCityBadge}>
                      <MapPin size={14} color={Colors.primary} />
                      <Typography variant="caption" style={styles.premiumCityBadgeText}>
                        Ville prête
                      </Typography>
                    </View>
                    <ChevronRight size={18} color={Colors.primary} />
                  </View>

                  <Typography variant="h2" style={styles.premiumCityTitle}>
                    {detectedCityName || 'Votre ville'}
                  </Typography>

                  <Typography variant="caption" color={Colors.textSecondary} style={styles.premiumCitySubtitle}>
                    {selectedMarketName
                      ? `${selectedMarketName}${selectedMarketDistance ? ` · ${selectedMarketDistance}` : ''}`
                      : 'Appuyez pour utiliser cette zone et continuer'}
                  </Typography>
                </TouchableOpacity>
              ) : null}

              {locationDebug ? (
                <View style={styles.gpsDebugBox}>
                  <Typography variant="caption" color={Colors.textSecondary} style={{ fontFamily: 'monospace' }}>
                    {locationDebug}
                  </Typography>
                </View>
              ) : null}

              <View style={styles.gpsActions}>
                <TouchableOpacity style={styles.gpsBtn} onPress={detectNearestMarket} disabled={isLoadingLocation}>
                  <View style={styles.gpsIcon}>
                    {isLoadingLocation ? <ActivityIndicator size="small" color={Colors.white} /> : <Zap size={18} color={Colors.white} />}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Typography variant="body" style={{ fontWeight: '700' }}>
                      {locationState === 'blocked' ? 'Réessayer le GPS' : 'Position automatique'}
                    </Typography>
                    <Typography variant="caption" color={Colors.textSecondary}>
                      Identifier le marché le plus proche par GPS
                    </Typography>
                  </View>
                </TouchableOpacity>

                {locationState === 'blocked' ? (
                  <TouchableOpacity style={styles.settingsBtn} onPress={openLocationSettings}>
                    <Typography variant="caption" color={Colors.primary} style={{ fontWeight: '800' }}>
                      Ouvrir les paramètres
                    </Typography>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View style={styles.manualNoteBox}>
              <Info size={14} color={Colors.textSecondary} />
              <Typography variant="caption" color={Colors.textSecondary} style={{ marginLeft: 8, flex: 1 }}>
                Le choix manuel est désactivé pour garantir la qualité du relevé.
              </Typography>
            </View>
          </Animated.View>
        )}

        {step === 1 && (
          <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={styles.stepContainer}>
            <View style={styles.stepTopRow}>
              <TouchableOpacity onPress={() => setStep(0)} style={styles.backBtn}>
                <ArrowLeft size={18} color={Colors.primary} />
                <Typography variant="caption" color={Colors.primary} style={{ marginLeft: 8, fontWeight: '700' }}>
                  Ville
                </Typography>
              </TouchableOpacity>
              <View style={styles.stepPill}>
                <Typography variant="caption" color={Colors.primary} style={{ fontWeight: '800' }}>
                  1
                </Typography>
                <Typography variant="caption" color={Colors.textSecondary} style={{ marginLeft: 6 }}>
                  Choisis le produit
                </Typography>
              </View>
            </View>

            <Typography variant="h1" style={styles.title}>
              Quel produit ?
            </Typography>

            <View style={styles.searchBox}>
              <Search size={18} color={Colors.textSecondary} />
              <TextInput
                placeholder="Chercher un produit"
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            {!selectedCategory && !searchQuery ? (
              <View style={styles.grid}>
                <TouchableOpacity
                  onPress={() => setSelectedCategory('all')}
                  style={[styles.catCard, { width: '48%', borderWidth: 1, borderColor: Colors.primary }]}
                >
                  <View style={styles.emojiCircle}>
                    <Typography variant="h1" style={{ fontSize: 32 }}>
                      ✦
                    </Typography>
                  </View>
                  <Typography variant="h2" style={{ fontSize: 13, marginTop: 12, textAlign: 'center' }}>
                    Tous les produits
                  </Typography>
                </TouchableOpacity>
                {categoryOptions.map((category) => (
                  <TouchableOpacity key={category} onPress={() => setSelectedCategory(category)} style={[styles.catCard, { width: '48%' }]}>
                    <View style={styles.emojiCircle}>
                      <Typography variant="h1" style={{ fontSize: 32 }}>
                        {CATEGORY_ICONS[category] ?? '🏷️'}
                      </Typography>
                    </View>
                    <Typography variant="h2" style={{ fontSize: 13, marginTop: 12, textAlign: 'center' }}>
                      {category}
                    </Typography>
                  </TouchableOpacity>
                ))}
                <View style={styles.customCategoryCard}>
                  <Typography variant="caption" color={Colors.textSecondary} style={{ fontWeight: '800' }}>
                    Autre catégorie
                  </Typography>
                  <View style={styles.customCategoryRow}>
                    <TextInput
                      value={customCategoryInput}
                      onChangeText={setCustomCategoryInput}
                      placeholder="Ex: Cosmétiques"
                      placeholderTextColor={Colors.textSecondary}
                      style={styles.customCategoryInput}
                    />
                    <TouchableOpacity style={styles.customCategoryButton} onPress={handleUseCustomCategory}>
                      <Plus size={16} color={Colors.white} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <View>
                {selectedCategory ? (
                  <TouchableOpacity onPress={() => setSelectedCategory(null)} style={styles.backBtn}>
                    <ArrowLeft size={18} color={Colors.primary} />
                    <Typography variant="caption" color={Colors.primary} style={{ marginLeft: 8, fontWeight: '700' }}>
                      Retour aux catégories
                    </Typography>
                  </TouchableOpacity>
                ) : null}

                <View style={styles.grid}>
                  {visibleProducts?.map((product: any) => (
                    <TouchableOpacity
                      key={product.id}
                      onPress={() => {
                        setSelectedProduct({
                          ...product,
                          id: product.resolvedProductId || product.id,
                        });
                        setStep(2);
                      }}
                      style={[styles.productCard, { width: '48%' }]}
                    >
                      <Typography variant="h2" style={{ fontSize: 13, textAlign: 'center' }} numberOfLines={2}>
                        {product.name}
                      </Typography>
                      <Typography variant="label" style={{ fontSize: 10, marginTop: 4 }}>
                        {product.unit}
                      </Typography>
                      {typeof product.price_value === 'number' ? (
                        <Typography variant="caption" color={Colors.primary} style={{ marginTop: 4, fontWeight: '800' }}>
                          {Math.round(product.price_value)} F
                        </Typography>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={() => {
                      if (searchQuery) setNewProductName(searchQuery);
                      setNewProductCategory(selectedCategory && selectedCategory !== 'all' ? selectedCategory : '');
                      setShowNewProductModal(true);
                    }}
                    style={[styles.productCard, styles.newProductCard, { width: '48%' }]}
                  >
                    <Plus size={20} color={Colors.primary} />
                    <Typography variant="caption" color={Colors.primary} style={{ marginTop: 4, fontWeight: '700', textAlign: 'center' }}>
                      Nouveau produit
                    </Typography>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {step === 2 && (
          <Animated.View entering={SlideInRight} exiting={FadeOut} style={styles.stepContainer}>
            <View style={styles.stepTopRow}>
              <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn}>
                <ArrowLeft size={18} color={Colors.primary} />
                <Typography variant="caption" color={Colors.primary} style={{ marginLeft: 8, fontWeight: '700' }}>
                  Produits
                </Typography>
              </TouchableOpacity>
              <View style={styles.stepPill}>
                <Typography variant="caption" color={Colors.primary} style={{ fontWeight: '800' }}>
                  2
                </Typography>
                <Typography variant="caption" color={Colors.textSecondary} style={{ marginLeft: 6 }}>
                  Détails du prix
                </Typography>
              </View>
            </View>

            <Card style={styles.summaryCard} variant="elevated">
              <View style={styles.compactSummaryHeader}>
                <View style={{ flex: 1 }}>
                  <Typography variant="label" color={Colors.primary}>
                    {selectedMarket?.name || 'Marché'}
                  </Typography>
                  <Typography variant="h2" style={styles.compactSummaryTitle} numberOfLines={1}>
                    {selectedProduct?.name}
                  </Typography>
                </View>
                {latestPriceInfo ? (
                  <View style={styles.referenceBadge}>
                    <Typography variant="caption" color={Colors.textSecondary}>
                      Dernier prix
                    </Typography>
                    <Typography variant="body" style={{ fontWeight: '800', color: Colors.primary }}>
                      {Number(latestPriceInfo.price_value).toLocaleString()} F
                    </Typography>
                  </View>
                ) : null}
              </View>
              <Typography variant="caption" color={Colors.textSecondary} style={styles.compactSummarySub}>
                {selectedProduct?.unit} · {selectedMarket?.city_id ? 'Ville enregistrée' : 'Marché sélectionné'}
              </Typography>
            </Card>

            {intelligence?.snapshot && (
              <Card style={styles.intelligenceCard} variant="outline">
                <View style={styles.radarHeader}>
                  <Typography variant="label" color={Colors.primary}>
                    Radar de référence
                  </Typography>
                  {externalSourceLabel ? (
                    <View
                      style={[
                        styles.radarSourcePill,
                        externalSourceLabel.tone === 'success' ? styles.sourceStatusSuccess : styles.sourceStatusInfo,
                      ]}
                    >
                      <Typography
                        variant="caption"
                        color={externalSourceLabel.tone === 'success' ? Colors.emerald : Colors.primary}
                        style={{ fontWeight: '700' }}
                      >
                        {externalSourceLabel.text}
                      </Typography>
                    </View>
                  ) : null}
                </View>
                <View style={styles.intelligenceStats}>
                  <View style={styles.intelligenceStat}>
                    <Typography variant="caption" color={Colors.textSecondary}>
                      Local
                    </Typography>
                    <Typography variant="h2">
                      {intelligence.snapshot.averagePrice ? `${Math.round(intelligence.snapshot.averagePrice)} F` : '--'}
                    </Typography>
                  </View>
                  <View style={styles.intelligenceStat}>
                    <Typography variant="caption" color={Colors.textSecondary}>
                      Web
                    </Typography>
                    <Typography variant="h2">
                      {intelligence.snapshot.externalAveragePrice ? `${Math.round(intelligence.snapshot.externalAveragePrice)} F` : '--'}
                    </Typography>
                  </View>
                  <View style={styles.intelligenceStat}>
                    <Typography variant="caption" color={Colors.textSecondary}>
                      Confiance
                    </Typography>
                    <Typography variant="h2">
                      {Math.round((intelligence.snapshot.confidenceScore || 0) * 100)}%
                    </Typography>
                  </View>
                </View>
              </Card>
            )}

            <View style={{ gap: 18 }}>
              <View style={styles.quantityCard}>
                <Typography variant="label" style={{ marginBottom: 10 }}>
                  Quantité ({selectedProduct?.unit})
                </Typography>
                <View style={styles.quantityContainer}>
                  <TouchableOpacity onPress={() => setQuantityInput((q) => Math.max(0.5, parseFloat(q || '1') - 0.5).toString())} style={styles.qtyBtn}>
                    <Typography variant="h1" color={Colors.primary}>
                      -
                    </Typography>
                  </TouchableOpacity>
                  <TextInput style={styles.qtyInput} value={quantityInput} onChangeText={setQuantityInput} keyboardType="numeric" />
                  <TouchableOpacity onPress={() => setQuantityInput((q) => (parseFloat(q || '1') + 0.5).toString())} style={styles.qtyBtn}>
                    <Typography variant="h1" color={Colors.primary}>
                      +
                    </Typography>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.priceArea}>
                <Typography variant="label" style={{ marginBottom: 10 }}>
                  Prix total pour {quantityInput} {selectedProduct?.unit}
                </Typography>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <TextInput
                    style={styles.priceInput}
                    placeholder="0"
                    keyboardType="numeric"
                    autoFocus
                    value={priceInput}
                    onChangeText={setPriceInput}
                    placeholderTextColor={Colors.border}
                  />
                  <Typography variant="h2" color={Colors.primary}>
                    XOF
                  </Typography>
                </View>
                {unitPrice > 0 && (
                  <Animated.View entering={FadeIn} style={styles.unitPriceTag}>
                    <Typography variant="caption" color={Colors.white} style={{ fontWeight: '700' }}>
                      Soit {unitPrice} FCFA / {selectedProduct?.unit}
                    </Typography>
                  </Animated.View>
                )}
              </View>
            </View>

            {priceSignal && (
              <Animated.View entering={FadeIn} style={styles.signalBox}>
                <Typography variant="label" color={Colors.primary}>
                  Lecture rapide
                </Typography>
                <View style={styles.signalStatsRow}>
                  {priceSignal.localGapPercent !== null ? (
                    <View style={styles.signalStatPill}>
                      <Typography variant="caption" color={Colors.textSecondary}>
                        Local
                      </Typography>
                      <Typography variant="caption" style={styles.signalStatValue}>
                        {priceSignal.localGapPercent > 0 ? '+' : ''}
                        {priceSignal.localGapPercent.toFixed(1)}%
                      </Typography>
                    </View>
                  ) : null}
                  {priceSignal.externalGapPercent !== null ? (
                    <View style={styles.signalStatPill}>
                      <Typography variant="caption" color={Colors.textSecondary}>
                        Web
                      </Typography>
                      <Typography variant="caption" style={styles.signalStatValue}>
                        {priceSignal.externalGapPercent > 0 ? '+' : ''}
                        {priceSignal.externalGapPercent.toFixed(1)}%
                      </Typography>
                    </View>
                  ) : null}
                  <View style={styles.signalStatPill}>
                    <Typography variant="caption" color={Colors.textSecondary}>
                      Lecture
                    </Typography>
                    <Typography variant="caption" style={styles.signalStatValue}>
                      {validationHelper?.title || 'OK'}
                    </Typography>
                  </View>
                </View>
              </Animated.View>
            )}

            <Button
              title={
                addPriceMutation.isPending
                  ? 'Envoi en cours...'
                  : validation?.isAnomaly
                  ? 'Vérifier avant envoi'
                  : 'Confirmer et enregistrer'
              }
              onPress={handleSubmit}
              loading={addPriceMutation.isPending}
              style={styles.submitBtn}
              disabled={!isPriceEntryValid || addPriceMutation.isPending}
            />
          </Animated.View>
        )}
      </ScrollView>

      <Modal visible={showNewProductModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeInDown.springify()} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Typography variant="h2">Nouveau produit</Typography>
              <TouchableOpacity onPress={() => setShowNewProductModal(false)}>
                <X size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 20, marginTop: 20 }}>
              <TextInput
                style={styles.modalInput}
                placeholder="Nom du produit"
                placeholderTextColor={Colors.textSecondary}
                value={newProductName}
                onChangeText={setNewProductName}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Catégorie"
                placeholderTextColor={Colors.textSecondary}
                value={newProductCategory}
                onChangeText={(value) => setNewProductCategory(formatProductCategory(value))}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Unité"
                placeholderTextColor={Colors.textSecondary}
                value={newProductUnit}
                onChangeText={setNewProductUnit}
              />
              <Button
                title="Créer et continuer"
                onPress={handleAddProduct}
                disabled={!newProductName || !newProductCategory || addProductMutation.isPending}
                loading={addProductMutation.isPending}
              />
            </View>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={showValidationReview} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeInDown.springify()} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Typography variant="h2">Vérifier ce relevé</Typography>
              <TouchableOpacity onPress={() => setShowValidationReview(false)}>
                <X size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ gap: 16, marginTop: 8 }}>
              <Card variant="outline" style={styles.reviewCard}>
                <Typography variant="body" style={{ fontWeight: '800' }}>
                  {selectedProduct?.name} • {selectedMarket?.name}
                </Typography>
                <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 8 }}>
                  {validation?.reason || 'Ce prix mérite une vérification supplémentaire avant publication.'}
                </Typography>
              </Card>

              <View style={styles.reviewChecklist}>
                <Typography variant="caption" color={Colors.textSecondary}>
                  Avant d’envoyer, vérifiez :
                </Typography>
                <Typography variant="caption" color={Colors.textSecondary}>
                  • la quantité saisie correspond bien à l’unité du produit
                </Typography>
                <Typography variant="caption" color={Colors.textSecondary}>
                  • le prix observé est bien celui pratiqué maintenant sur le marché
                </Typography>
                <Typography variant="caption" color={Colors.textSecondary}>
                  • il ne s’agit pas d’une promotion ou d’une rupture ponctuelle
                </Typography>
              </View>

              <View style={styles.modalButtons}>
                <Button
                  title="Revoir"
                  variant="secondary"
                  onPress={() => setShowValidationReview(false)}
                  style={{ flex: 1 }}
                />
                <View style={{ width: 12 }} />
                <Button
                  title={addPriceMutation.isPending ? 'Envoi...' : 'Envoyer quand même'}
                  onPress={async () => {
                    setShowValidationReview(false);
                    await submitPrice();
                  }}
                  style={{ flex: 1 }}
                  loading={addPriceMutation.isPending}
                  disabled={addPriceMutation.isPending}
                />
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.md, paddingBottom: Layout.tabScreenBottomPadding },
  stepsRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.lg, justifyContent: 'center' },
  stepDot: { width: 48, height: 6, borderRadius: Radius.pill, backgroundColor: Colors.border },
  stepDotActive: { backgroundColor: Colors.primary },
  stepContainer: { flex: 1 },
  stepTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: { marginBottom: Spacing.xs },
  subtitle: { marginBottom: Spacing.lg },
  listItem: { marginBottom: Spacing.md, paddingVertical: 12 },
  listRow: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EBF4FF', justifyContent: 'center', alignItems: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  debugCard: {
    marginBottom: Spacing.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '18',
    backgroundColor: Colors.primary + '08',
  },
  debugHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  debugPill: {
    backgroundColor: Colors.card,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16, color: Colors.text, backgroundColor: 'transparent' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  catCard: { backgroundColor: Colors.card, borderRadius: Radius.lg, padding: 16, alignItems: 'center', marginBottom: 4, borderWidth: 1, borderColor: Colors.border, ...Shadows.soft },
  customCategoryCard: {
    width: '100%',
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  customCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customCategoryInput: {
    flex: 1,
    minHeight: 46,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    paddingHorizontal: 12,
  },
  customCategoryButton: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, alignItems: 'center', marginBottom: 4, ...Shadows.soft, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, borderLeftColor: Colors.primary },
  newProductCard: { borderStyle: 'dashed', borderWidth: 2, borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  emojiCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  referenceBadge: { backgroundColor: Colors.primary + '10', padding: 8, borderRadius: Radius.md, alignItems: 'flex-end', borderWidth: 1, borderColor: Colors.primary + '30' },
  summaryCard: { marginVertical: 14, padding: 14, gap: 10 },
  compactSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  compactSummaryTitle: {
    fontSize: 20,
    marginTop: 4,
  },
  compactSummarySub: {
    marginTop: 6,
  },
  intelligenceCard: { marginBottom: Spacing.lg },
  radarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  radarSourcePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sourceStatusBanner: {
    marginTop: 12,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceStatusSuccess: {
    backgroundColor: Colors.emerald + '14',
  },
  sourceStatusInfo: {
    backgroundColor: Colors.primary + '12',
  },
  intelligenceStats: { flexDirection: 'row', gap: 10, marginTop: 12 },
  intelligenceStat: { flex: 1 },
  quantityCard: {
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  signalStatsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 10,
  },
  signalStatPill: {
    minWidth: 92,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  signalStatValue: {
    marginTop: 4,
    fontWeight: '800',
    color: Colors.primary,
  },
  intelligenceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  intelligenceChip: { backgroundColor: Colors.background, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill },
  priceArea: {
    alignItems: 'center',
    marginVertical: 10,
    padding: 20,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  priceInput: { fontSize: 56, fontWeight: '800', color: Colors.primary, textAlign: 'center', minWidth: 150, backgroundColor: 'transparent' },
  quantityContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 15 },
  qtyBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  qtyInput: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    width: 90,
    minHeight: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unitPriceTag: { backgroundColor: Colors.emerald, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 16 },
  signalBox: {
    marginTop: Spacing.lg,
    padding: 16,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  validationStatusCard: {
    marginTop: 4,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  validationStatusError: {
    backgroundColor: Colors.error + '10',
  },
  validationStatusInfo: {
    backgroundColor: Colors.primary + '10',
  },
  validationStatusSuccess: {
    backgroundColor: Colors.emerald + '10',
  },
  feedbackBanner: {
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  feedbackSuccess: {
    backgroundColor: Colors.emerald,
  },
  feedbackError: {
    backgroundColor: Colors.error,
  },
  feedbackInfo: {
    backgroundColor: Colors.primary,
  },
  successBanner: {
    backgroundColor: Colors.emerald,
    borderRadius: Radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  successIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtn: { marginTop: Spacing.xl },
  gpsStatusCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: Radius.lg,
    marginTop: 12,
    marginBottom: 20,
    ...Shadows.soft,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
    gap: 12,
  },
  gpsStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsActions: {
    gap: 10,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: Radius.lg,
    ...Shadows.soft,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  settingsBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary + '10',
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  gpsIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary },
  gpsHelpBox: {
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  premiumCityBtn: {
    padding: 16,
    borderRadius: Radius.lg,
    backgroundColor: '#F5FAFF',
    borderWidth: 1,
    borderColor: '#B9D8FF',
    gap: 10,
    ...Shadows.soft,
  },
  premiumCityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  premiumCityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary + '12',
    borderWidth: 1,
    borderColor: Colors.primary + '18',
  },
  premiumCityBadgeText: {
    fontWeight: '800',
    color: Colors.primary,
  },
  premiumCityTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.text,
  },
  premiumCitySubtitle: {
    lineHeight: 18,
  },
  gpsDebugBox: {
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, opacity: 0.5 },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  manualNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.card, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, paddingBottom: Layout.screenBottomPadding, minHeight: 320 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalButtons: { flexDirection: 'row', marginTop: 8 },
  modalInput: { backgroundColor: Colors.background, borderRadius: Radius.md, padding: 16, fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  reviewCard: { borderColor: Colors.error + '35' },
  reviewChecklist: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: 14,
    gap: 6,
  },
});

