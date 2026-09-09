import React from 'react';
import { Platform } from 'react-native';

import { MarketAtlas } from './MarketAtlas';

type MarketPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

type MarketMapMode = 'atlas' | 'client' | 'merchant';

interface RealMarketMapProps {
  markets: MarketPoint[];
  onSelectMarket: (market: MarketPoint) => void;
  selectedMarketId?: string;
  userLocation?: { latitude: number; longitude: number } | null;
  mode?: MarketMapMode;
}

export const RealMarketMap = (props: RealMarketMapProps) => {
  if (Platform.OS === 'web') {
    return <MarketAtlas {...props} />;
  }

  const NativeRealMarketMap = require('./RealMarketMap.native').RealMarketMap as React.ComponentType<RealMarketMapProps>;
  return <NativeRealMarketMap {...props} />;
};
