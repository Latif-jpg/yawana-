import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Path, Circle, G, Text as SvgText } from 'react-native-svg';
import Animated, { FadeIn, useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { Colors, Radius, Spacing, Shadows } from '@/constants/Theme';
import { Typography } from './Typography';
import { Plus, Minus, RefreshCcw } from 'lucide-react-native';
import { useState } from 'react';
import { PanGestureHandler, GestureHandlerRootView } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MarketAtlasProps {
    markets: any[];
    onSelectMarket: (market: any) => void;
    selectedMarketId?: string;
    userLocation?: { latitude: number; longitude: number } | null;
    mode?: 'atlas' | 'client' | 'merchant';
}

// Simplified Burkina Faso Shape (5 Pilot Regions + Supporting Outline)
const MAP_PATHS = [
    { id: 'nord', d: 'M130,30 L200,30 L180,80 L110,70 Z', name: 'Nord (Ouahigouya)', isPilot: true },
    { id: 'centre', d: 'M120,80 L180,80 L180,140 L120,140 Z', name: 'Centre (Ouagadougou)', isPilot: true },
    { id: 'centre-ouest', d: 'M70,90 L120,80 L120,150 L70,160 Z', name: 'Centre-Ouest (Koudougou)', isPilot: true },
    { id: 'hauts-bassins', d: 'M30,140 L90,140 L80,210 L10,210 Z', name: 'Hauts-Bassins (Bobo)', isPilot: true },
    { id: 'sud-ouest', d: 'M30,210 L90,200 L80,270 L30,270 Z', name: 'Sud-Ouest (Gaoua)', isPilot: true },
    { id: 'sahel', d: 'M180,20 L280,40 L260,80 L180,60 Z', name: 'Sahel', isPilot: false },
    { id: 'est', d: 'M180,80 L280,90 L280,200 L180,180 Z', name: 'Est', isPilot: false },
    { id: 'cascades', d: 'M10,210 L60,210 L50,270 L10,270 Z', name: 'Cascades', isPilot: false },
];

const MODE_META = {
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
} as const;

export const MarketAtlas = ({ markets, onSelectMarket, selectedMarketId, userLocation, mode = 'atlas' }: MarketAtlasProps) => {
    const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 300, h: 300 });
    const activeMode = MODE_META[mode];

    const handleZoom = (delta: number) => {
        setViewBox(prev => {
            const newW = Math.max(100, Math.min(350, prev.w + delta));
            const newH = Math.max(100, Math.min(350, prev.h + delta));
            // Recenter based on new dimensions
            const diffW = (prev.w - newW) / 2;
            const diffH = (prev.h - newH) / 2;
            return {
                x: prev.x + diffW,
                y: prev.y + diffH,
                w: newW,
                h: newH
            };
        });
    };

    const resetZoom = () => setViewBox({ x: 0, y: 0, w: 300, h: 300 });

    // Helper to map Lat/Long to SVG coordinate space (300x300)
    // BF Bounds approx: Lat [9, 15], Long [-5, 2]
    const mapCoords = (lat: number, lon: number) => {
        const x = ((lon + 5.5) / 7) * 280 + 10;
        const y = 300 - (((lat - 9) / 6.5) * 280 + 10);
        return { x, y };
    };

    return (
        <GestureHandlerRootView style={styles.container}>
            <PanGestureHandler
                onGestureEvent={(e) => {
                    const scaleFactor = viewBox.w / 300;
                    setViewBox(prev => ({
                        ...prev,
                        x: prev.x - (e.nativeEvent.translationX / 20 * scaleFactor),
                        y: prev.y - (e.nativeEvent.translationY / 20 * scaleFactor),
                    }));
                }}
            >
                <View>
                    <Svg 
                        width={300} height={300} 
                        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`} 
                        style={styles.svg}
                    >
                        {/* Regional Backgrounds */}
                        {MAP_PATHS.map((region) => (
                            <Path 
                                key={region.id}
                                d={region.d}
                                fill={region.isPilot ? `${activeMode.accent}15` : '#F5F5F7'}
                                stroke={region.isPilot ? activeMode.accent : '#E0E0E0'}
                                strokeWidth={region.isPilot ? '1.5' : '1'}
                            />
                        ))}

                        {/* Market Markers */}
                        {markets.map((m) => {
                            const { x, y } = mapCoords(m.latitude, m.longitude);
                            const isSelected = selectedMarketId === m.id;
                            const scaleFactor = viewBox.w / 300;
                            const showLabel = isSelected || scaleFactor < 0.6;

                            return (
                                <G key={m.id}>
                                    <Circle
                                        cx={x}
                                        cy={y}
                                        r={(isSelected ? 10 : 6) * scaleFactor}
                                        fill={isSelected ? activeMode.accent : Colors.border}
                                        opacity={isSelected ? 0.28 : 0.4}
                                    />
                                    <Circle
                                        cx={x}
                                        cy={y}
                                        r={(isSelected ? 5 : 3) * scaleFactor}
                                        fill={isSelected ? activeMode.accent : '#A0AEC0'}
                                        stroke="#FFF"
                                        strokeWidth={1 * scaleFactor}
                                    />
                                    {showLabel && (
                                        <G>
                                            <SvgText
                                                x={x}
                                                y={y - (10 * scaleFactor)}
                                                fontSize={9 * scaleFactor}
                                                fontWeight="800"
                                                fill="#FFF"
                                                stroke="#FFF"
                                                strokeWidth={3 * scaleFactor}
                                                textAnchor="middle"
                                                opacity={0.8}
                                            >
                                                {m.name.split(' ')[0]}
                                            </SvgText>
                                            <SvgText
                                                x={x}
                                                y={y - (10 * scaleFactor)}
                                                fontSize={9 * scaleFactor}
                                                fontWeight="700"
                                                fill={isSelected ? activeMode.accent : Colors.text}
                                                textAnchor="middle"
                                            >
                                                {m.name.split(' ')[0]}
                                            </SvgText>
                                        </G>
                                    )}
                                </G>
                            );
                        })}

                        {/* User Location Marker */}
                        {userLocation && (() => {
                            const { x, y } = mapCoords(userLocation.latitude, userLocation.longitude);
                            const scaleFactor = viewBox.w / 300;
                            return (
                                <G>
                                    <Circle 
                                        cx={x} cy={y} r={10 * scaleFactor} 
                                        fill={Colors.emerald} 
                                        opacity={0.3} 
                                    />
                                    <Circle 
                                        cx={x} cy={y} r={5 * scaleFactor} 
                                        fill={Colors.emerald} 
                                        stroke="#FFF" strokeWidth={2 * scaleFactor}
                                    />
                                    <SvgText
                                        x={x} y={y + (16 * scaleFactor)}
                                        fontSize={8 * scaleFactor}
                                        fontWeight="800"
                                        fill={Colors.emerald}
                                        textAnchor="middle"
                                    >
                                        VOUS (GPS)
                                    </SvgText>
                                </G>
                            );
                        })()}
                    </Svg>

                    <View pointerEvents="box-none" style={styles.interactiveLayer}>
                        {markets.map((market) => {
                            const { x, y } = mapCoords(market.latitude, market.longitude);
                            const isSelected = selectedMarketId === market.id;
                            const label = market.name.split(' ')[0];
                            const scaleFactor = viewBox.w / 300;
                            const showLabel = isSelected || scaleFactor < 0.6;

                            return (
                                <TouchableOpacity
                                    key={market.id}
                                    activeOpacity={0.85}
                                    onPress={() => onSelectMarket(market)}
                                    style={[
                                        styles.markerHitbox,
                                        {
                                            left: x - 20,
                                            top: y - 20,
                                        },
                                    ]}
                                >
                                    <View style={[styles.markerGlow, isSelected && styles.markerGlowSelected]} />
                                    <View style={[styles.markerDot, isSelected && styles.markerDotSelected]} />
                                    {showLabel ? (
                                        <View style={[styles.markerLabel, isSelected && styles.markerLabelSelected]}>
                                            <Typography variant="caption" style={styles.markerLabelText} numberOfLines={1}>
                                                {label}
                                            </Typography>
                                        </View>
                                    ) : null}
                                </TouchableOpacity>
                            );
                        })}

                        {userLocation ? (() => {
                            const { x, y } = mapCoords(userLocation.latitude, userLocation.longitude);
                            return (
                                <View style={[styles.userMarker, { left: x - 10, top: y - 10 }]}>
                                    <View style={styles.userMarkerRing} />
                                    <View style={styles.userMarkerDot} />
                                </View>
                            );
                        })() : null}
                    </View>
                </View>
            </PanGestureHandler>

            <View style={styles.overlay}>
               <Typography variant="caption" style={{ fontWeight: '700', color: Colors.textSecondary }}>
                   {activeMode.label} · {markets.length} marchés connectés
               </Typography>
               <Typography variant="caption" style={{ color: Colors.textSecondary, marginTop: 2 }}>
                   {activeMode.description}
               </Typography>
            </View>

            {/* Zoom Controls */}
            <View style={styles.controls}>
                <TouchableOpacity onPress={() => handleZoom(-50)} style={styles.controlBtn}>
                    <Plus size={18} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleZoom(50)} style={styles.controlBtn}>
                    <Minus size={18} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={resetZoom} style={[styles.controlBtn, { marginTop: 10 }]}>
                    <RefreshCcw size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
            </View>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 300,
        height: 300,
        backgroundColor: '#FFF',
        borderRadius: Radius.xl,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadows.soft,
        overflow: 'hidden',
    },
    svg: {
        backgroundColor: '#F8F9FB',
    },
    interactiveLayer: {
        ...StyleSheet.absoluteFillObject,
    },
    markerHitbox: {
        position: 'absolute',
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    markerGlow: {
        position: 'absolute',
        width: 24,
        height: 24,
        borderRadius: 999,
        backgroundColor: 'rgba(160,174,192,0.18)',
    },
    markerGlowSelected: {
        width: 30,
        height: 30,
        backgroundColor: 'rgba(10,132,255,0.18)',
    },
    markerDot: {
        width: 10,
        height: 10,
        borderRadius: 999,
        backgroundColor: '#A0AEC0',
        borderWidth: 2,
        borderColor: Colors.white,
    },
    markerDotSelected: {
        width: 12,
        height: 12,
        backgroundColor: Colors.primary,
    },
    markerLabel: {
        position: 'absolute',
        top: -18,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: Radius.pill,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderWidth: 1,
        borderColor: 'rgba(15,23,42,0.08)',
        maxWidth: 90,
    },
    markerLabelSelected: {
        backgroundColor: 'rgba(10,132,255,0.12)',
        borderColor: 'rgba(10,132,255,0.16)',
    },
    markerLabelText: {
        fontWeight: '800',
        color: Colors.text,
        fontSize: 10,
    },
    userMarker: {
        position: 'absolute',
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    userMarkerRing: {
        position: 'absolute',
        width: 26,
        height: 26,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: 'rgba(48,209,88,0.32)',
    },
    userMarkerDot: {
        width: 10,
        height: 10,
        borderRadius: 999,
        backgroundColor: Colors.emerald,
        borderWidth: 2,
        borderColor: Colors.white,
    },
    overlay: {
        position: 'absolute',
        top: 15,
        left: 15,
        backgroundColor: 'rgba(255,255,255,0.8)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: Radius.pill,
    },
    controls: {
        position: 'absolute',
        bottom: 15,
        right: 15,
        gap: 8,
    },
    controlBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: Colors.background,
    }
});
