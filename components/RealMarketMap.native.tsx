import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Colors, Radius, Shadows } from '@/constants/Theme';

type MarketPoint = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

interface RealMarketMapProps {
  markets: MarketPoint[];
  onSelectMarket: (market: MarketPoint) => void;
  selectedMarketId?: string;
  userLocation?: { latitude: number; longitude: number } | null;
  mode?: 'atlas' | 'client' | 'merchant';
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const RealMarketMap = ({
  markets,
  onSelectMarket,
  selectedMarketId,
  userLocation,
  mode = 'atlas',
}: RealMarketMapProps) => {
  const webViewRef = useRef<WebView>(null);
  const modeMeta = {
    atlas: {
      label: 'Atlas',
      description: 'Vue globale et neutre',
      accent: Colors.primary,
    },
    client: {
      label: 'Client',
      description: 'Proche et fiable',
      accent: Colors.emerald,
    },
    merchant: {
      label: 'Commerçant',
      description: 'Écarts et opportunités',
      accent: Colors.gold,
    },
  }[mode];

  const center = useMemo(() => {
    const base = markets.length > 0 ? markets[0] : { latitude: 12.3714, longitude: -1.5197 };
    return { lat: base.latitude, lon: base.longitude };
  }, [markets]);

  const sanitizedMarkets = useMemo(
    () =>
      markets.map((market) => ({
        id: market.id,
        name: market.name,
        latitude: market.latitude,
        longitude: market.longitude,
      })),
    [markets]
  );

  const html = useMemo(() => {
    const marketsJson = JSON.stringify(sanitizedMarkets).replace(/</g, '\\u003c');
    const userLocationJson = JSON.stringify(userLocation).replace(/</g, '\\u003c');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <style>
            html, body, #map {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              background:
                radial-gradient(circle at top, rgba(10,132,255,0.08), transparent 40%),
                linear-gradient(180deg, #f8f9fb 0%, #eef3f8 100%);
            }
            .leaflet-container {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            .leaflet-control-zoom {
              border: none !important;
              box-shadow: 0 14px 30px rgba(15, 23, 42, 0.15) !important;
              overflow: hidden;
              border-radius: 18px !important;
            }
            .leaflet-control-zoom a {
              background: rgba(255,255,255,0.95) !important;
              color: #0f172a !important;
              width: 38px !important;
              height: 38px !important;
              line-height: 38px !important;
              border: none !important;
            }
            .leaflet-control-zoom a:first-child {
              border-bottom: 1px solid rgba(15, 23, 42, 0.08) !important;
            }
            .leaflet-control-attribution {
              font-size: 9px;
              background: rgba(255,255,255,0.75) !important;
              border-radius: 999px;
              padding: 2px 8px;
              margin: 0 10px 10px 0 !important;
            }
            .market-marker {
              position: relative;
              width: 14px;
              height: 14px;
              border-radius: 999px;
              background: ${modeMeta.accent};
              border: 2px solid white;
              box-shadow: 0 6px 14px rgba(10, 132, 255, 0.35);
              transform: translate3d(0,0,0);
            }
            .market-marker::before {
              content: '';
              position: absolute;
              inset: -10px;
              border-radius: 999px;
              background: rgba(10, 132, 255, 0.16);
              transform: scale(0.65);
              opacity: 0.55;
            }
            .market-marker::after {
              content: '';
              position: absolute;
              inset: -18px;
              border-radius: 999px;
              background: rgba(10, 132, 255, 0.14);
              animation: pulse 2.2s ease-in-out infinite;
            }
            .market-marker.selected {
              width: 18px;
              height: 18px;
              background: linear-gradient(180deg, ${modeMeta.accent} 0%, #0A84FF 100%);
              border-width: 3px;
              box-shadow: 0 8px 22px rgba(48, 209, 88, 0.35);
            }
            .market-marker.selected::before {
              inset: -14px;
              background: rgba(48, 209, 88, 0.18);
              transform: scale(0.9);
            }
            .market-marker.selected::after {
              inset: -24px;
              background: rgba(48, 209, 88, 0.18);
            }
            .user-marker {
              position: relative;
              width: 16px;
              height: 16px;
              border-radius: 999px;
              background: ${Colors.emerald};
              border: 2px solid white;
              box-shadow: 0 8px 20px rgba(48, 209, 88, 0.35);
            }
            .user-marker::before {
              content: '';
              position: absolute;
              inset: -14px;
              border-radius: 999px;
              border: 2px solid rgba(48, 209, 88, 0.35);
              animation: ping 2s ease-out infinite;
            }
            .market-label {
              font-size: 11px;
              font-weight: 700;
              color: #0f172a;
              text-shadow: 0 1px 2px rgba(255,255,255,0.9);
              background: rgba(255,255,255,0.7);
              padding: 4px 8px;
              border-radius: 999px;
              border: 1px solid rgba(15,23,42,0.08);
              box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
              white-space: nowrap;
            }
            .top-chip {
              position: absolute;
              left: 12px;
              top: 12px;
              z-index: 500;
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 8px 12px;
              border-radius: 999px;
              background: rgba(255,255,255,0.88);
              border: 1px solid rgba(255,255,255,0.7);
              box-shadow: 0 14px 30px rgba(15, 23, 42, 0.12);
              backdrop-filter: blur(16px);
            }
            .top-chip strong {
              font-size: 12px;
              color: #0f172a;
            }
            .top-chip span {
              font-size: 11px;
              color: #64748b;
            }
            .legend {
              position: absolute;
              left: 12px;
              bottom: 12px;
              z-index: 500;
              display: grid;
              gap: 8px;
              padding: 10px 12px;
              border-radius: 18px;
              background: rgba(255,255,255,0.88);
              border: 1px solid rgba(255,255,255,0.72);
              box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
              backdrop-filter: blur(16px);
            }
            .legend-row {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 11px;
              color: #334155;
            }
            .legend-dot {
              width: 10px;
              height: 10px;
              border-radius: 999px;
              flex: 0 0 auto;
            }
            @keyframes pulse {
              0% { transform: scale(0.65); opacity: 0.65; }
              70% { transform: scale(1); opacity: 0; }
              100% { transform: scale(1); opacity: 0; }
            }
            @keyframes ping {
              0% { transform: scale(0.8); opacity: 0.65; }
              80% { transform: scale(1.15); opacity: 0; }
              100% { transform: scale(1.15); opacity: 0; }
            }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <div class="top-chip">
            <strong>${modeMeta.label}</strong>
            <span>${sanitizedMarkets.length} points actifs</span>
          </div>
          <div class="top-chip" style="top: 54px;">
            <strong>${modeMeta.description}</strong>
          </div>
          <div class="legend">
            <div class="legend-row">
              <span class="legend-dot" style="background:${modeMeta.accent}"></span>
              Marché
            </div>
            <div class="legend-row">
              <span class="legend-dot" style="background:${Colors.emerald}"></span>
              Votre position
            </div>
            <div class="legend-row">
              <span class="legend-dot" style="background:#CBD5E1"></span>
              Réseau local
            </div>
          </div>
          <script>
            const map = L.map('map', {
              zoomControl: true,
              preferCanvas: true,
            }).setView([${center.lat}, ${center.lon}], ${markets.length > 1 ? 7 : 12});

            const marketData = ${marketsJson};
            const userLocation = ${userLocationJson};
            const markers = new Map();
            let selectedId = ${selectedMarketId ? `'${escapeHtml(selectedMarketId)}'` : 'null'};

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; OpenStreetMap contributors',
              maxZoom: 19
            }).addTo(map);

            const marketIcon = (isSelected) =>
              L.divIcon({
                className: '',
                html: '<div class="market-marker' + (isSelected ? ' selected' : '') + '"></div>',
                iconSize: isSelected ? [18, 18] : [14, 14],
                iconAnchor: isSelected ? [9, 9] : [7, 7]
              });

            const userIcon = L.divIcon({
              className: '',
              html: '<div class="user-marker"></div>',
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            });

            function renderMarkets() {
              markers.forEach((marker) => marker.remove());
              markers.clear();

              const marketBounds = [];

              marketData.forEach((market) => {
                marketBounds.push([market.latitude, market.longitude]);

                const marker = L.marker([market.latitude, market.longitude], {
                  icon: marketIcon(market.id === selectedId)
                }).addTo(map);

                marker.bindTooltip(market.name || 'Marche', {
                  direction: 'top',
                  opacity: 0.92,
                  sticky: true,
                  className: 'market-tooltip',
                });

                marker.on('click', () => {
                  selectedId = market.id;
                  renderMarkets();
                  map.setView([market.latitude, market.longitude], Math.max(map.getZoom(), 13), { animate: true });
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'MARKET_SELECTED',
                    id: market.id
                  }));
                });

                markers.set(market.id, marker);
              });

              if (marketBounds.length > 1) {
                map.fitBounds(marketBounds, { padding: [40, 40] });
              }
            }

            if (userLocation && userLocation.latitude && userLocation.longitude) {
              L.marker([userLocation.latitude, userLocation.longitude], { icon: userIcon }).addTo(map);
            }

            renderMarkets();

            if (selectedId) {
              const selectedMarket = marketData.find((item) => item.id === selectedId);
              if (selectedMarket) {
                map.setView([selectedMarket.latitude, selectedMarket.longitude], Math.max(map.getZoom(), 13), { animate: true });
              }
            }

            window.setSelectedMarket = function(id) {
              selectedId = id;
              renderMarkets();
              const market = marketData.find((item) => item.id === id);
              if (market) {
                map.setView([market.latitude, market.longitude], Math.max(map.getZoom(), 13), { animate: true });
              }
            };
          </script>
        </body>
      </html>
    `;
  }, [center.lat, center.lon, mode, sanitizedMarkets, selectedMarketId, userLocation]);

  useEffect(() => {
    if (!selectedMarketId) return;

    const script = `
      if (window.setSelectedMarket) {
        window.setSelectedMarket(${JSON.stringify(selectedMarketId)});
      }
      true;
    `;

    webViewRef.current?.injectJavaScript(script);
  }, [selectedMarketId]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data);
            if (payload?.type === 'MARKET_SELECTED') {
              const market = markets.find((item) => item.id === payload.id);
              if (market) onSelectMarket(market);
            }
          } catch {
            // Ignore malformed messages from the embedded page.
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 350,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadows.soft,
    backgroundColor: Colors.white,
  },
  webview: {
    flex: 1,
    backgroundColor: Colors.white,
  },
});
