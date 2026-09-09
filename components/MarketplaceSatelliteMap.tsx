import { Platform } from 'react-native';

export type MarketplaceSellerLocation = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  trustScore: number;
  verified: boolean;
};

type Props = {
  sellers: MarketplaceSellerLocation[];
  onSelectSeller: (sellerId: string) => void;
};

export function MarketplaceSatelliteMap(props: Props) {
  if (Platform.OS === 'web') {
    const WebMap = require('./MarketplaceSatelliteMap.web').MarketplaceSatelliteMapWeb;
    return <WebMap {...props} />;
  }

  const NativeMap = require('./MarketplaceSatelliteMap.native').MarketplaceSatelliteMapNative;
  return <NativeMap {...props} />;
}
