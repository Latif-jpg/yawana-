import { useMemo } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { MarketplaceSellerLocation } from './MarketplaceSatelliteMap';

type Props = {
  sellers: MarketplaceSellerLocation[];
  onSelectSeller: (sellerId: string) => void;
};

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const STREET_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const SATELLITE_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

function buildMapHtml(sellers: MarketplaceSellerLocation[]) {
  const sellersJson = JSON.stringify(sellers).replace(/</g, '\\u003c');
  const firstSeller = sellers[0];
  const center = firstSeller ? `${firstSeller.latitude}, ${firstSeller.longitude}` : '12.3714, -1.5197';

  return `<!doctype html>
<html lang="fr">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="${LEAFLET_CSS}" />
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; background: #e8eef3; }
    .leaflet-control-layers { border: 0; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,.14); }
    .shop-marker { width: 30px; height: 30px; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,.28); }
    .shop-marker.online { background: #16a34a; }
    .shop-marker.offline { background: #64748b; }
    .leaflet-popup-content { margin: 12px 14px; font-family: Arial, sans-serif; }
    .shop-name { font-size: 15px; font-weight: 700; margin-bottom: 5px; }
    .shop-status { font-size: 12px; color: #475569; }
    .directions-button { margin-top: 9px; padding: 7px 10px; border: 0; border-radius: 7px; background: #0f766e; color: white; font-weight: 700; }
    .map-modes { position: absolute; z-index: 1000; top: 12px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; padding: 4px; border-radius: 10px; background: rgba(255,255,255,.95); box-shadow: 0 2px 10px rgba(0,0,0,.18); }
    .map-mode { border: 0; border-radius: 7px; padding: 8px 12px; background: transparent; color: #334155; font-weight: 700; }
    .map-mode.active { background: #0f766e; color: white; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="${LEAFLET_JS}"></script>
  <script>
    const sellers = ${sellersJson};
    const map = L.map('map', { zoomControl: true }).setView([${center}], ${firstSeller ? 12 : 6});
    const streetLayer = L.tileLayer('${STREET_TILES}', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });
    const satelliteLayer = L.tileLayer('${SATELLITE_TILES}', {
      maxZoom: 18,
      attribution: 'Tiles &copy; Esri'
    });
    let activeLayer = streetLayer;
    streetLayer.addTo(map);
    function selectLayer(mode) {
      const nextLayer = mode === 'satellite' ? satelliteLayer : streetLayer;
      if (activeLayer !== nextLayer) {
        map.removeLayer(activeLayer);
        nextLayer.addTo(map);
        activeLayer = nextLayer;
      }
      document.querySelectorAll('.map-mode').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
    }
    window.selectMapLayer = selectLayer;
    document.body.insertAdjacentHTML('afterbegin', '<div class="map-modes"><button class="map-mode active" data-mode="street">Rue</button><button class="map-mode" data-mode="satellite">Satellite</button></div>');
    document.addEventListener('click', (event) => {
      const modeButton = event.target.closest('.map-mode');
      if (modeButton) selectLayer(modeButton.dataset.mode);
    });

    sellers.forEach((seller) => {
      const icon = L.divIcon({
        className: '',
        html: '<div class="shop-marker ' + (seller.isOnline ? 'online' : 'offline') + '"></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      const marker = L.marker([seller.latitude, seller.longitude], { icon }).addTo(map);
      marker.bindPopup(
        '<div class="shop-name">' + seller.name + '</div>' +
        '<div class="shop-status" style="color:' + (seller.isOnline ? '#16a34a' : '#475569') + '">' + (seller.isOnline ? 'En ligne maintenant' : 'Hors ligne') + '</div>' +
        '<div class="shop-status">Fiabilite ' + seller.trustScore + '/100</div>' +
        '<button class="directions-button" data-seller-id="' + seller.id + '">Itineraire</button>'
      );
      marker.on('click', () => window.ReactNativeWebView.postMessage(JSON.stringify({ sellerId: seller.id })));
    });
    document.addEventListener('click', (event) => {
      const button = event.target.closest('.directions-button');
      if (button) {
        window.ReactNativeWebView.postMessage('DIRECTIONS:' + button.dataset.sellerId);
      }
    });
  </script>
</body>
</html>`;
}

export function MarketplaceSatelliteMap({ sellers, onSelectSeller }: Props) {
  const html = useMemo(() => buildMapHtml(sellers), [sellers]);

  return (
    <View style={styles.container}>
      <WebView
        style={styles.webview}
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled={false}
        incognito
        setSupportMultipleWindows={false}
        onHttpError={(event) => console.warn('[map:webview:http]', event.nativeEvent.statusCode, event.nativeEvent.url)}
        onError={(event) => console.warn('[map:webview:error]', event.nativeEvent.description)}
        onMessage={(event) => {
          try {
            const message = event.nativeEvent.data;
            if (message.startsWith('DIRECTIONS:')) {
              const seller = sellers.find((item) => item.id === message.slice('DIRECTIONS:'.length));
              if (seller) {
                const destination = `${seller.latitude},${seller.longitude}`;
                void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`);
              }
              return;
            }

            const payload = JSON.parse(message);
            if (payload?.sellerId) onSelectSeller(String(payload.sellerId));
          } catch {
            // Les messages non JSON du document sont ignorés.
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: 460, borderRadius: 12, overflow: 'hidden' },
  webview: { flex: 1, backgroundColor: '#e8eef3' },
});
