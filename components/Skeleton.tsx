import { View, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { Colors, Radius } from '../constants/Theme';

interface Props {
  width?: number | string;
  height: number | string;
  borderRadius?: number;
  style?: any;
}

export const Skeleton = ({ width = '100%', height, borderRadius = Radius.md, style }: Props) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: Colors.border,
  },
});
