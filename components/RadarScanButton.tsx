import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Pressable, StyleSheet, Text } from 'react-native';

export default function RadarScanButton() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Pressable
      onPressIn={() => {
        scale.value = withSpring(0.95);
        opacity.value = withSpring(0.8);
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
        opacity.value = withSpring(1);
      }}
      onPress={() => console.log('Scan des prix en cours...')}
    >
      <Animated.View style={[styles.button, animatedStyle]}>
        <Text style={styles.text}>Scanner le Marche</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#0F172A',
    paddingVertical: 18,
    paddingHorizontal: 25,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  text: {
    color: '#10B981',
    fontWeight: '800',
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});
