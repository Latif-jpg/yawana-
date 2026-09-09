import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { Colors, Shadows, Radius } from '../constants/Theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  variant?: 'default' | 'glass' | 'elevated' | 'outline';
}

export const Card = ({ children, style, variant = 'default' }: Props) => {
  return (
    <View style={[
      styles.card, 
      styles[variant],
      style
    ]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  default: {
    ...Shadows.soft,
  },
  elevated: {
    ...Shadows.premium,
  },
  glass: {
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
        web: { backdropFilter: 'blur(10px)' } as any
    })
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  }
});
