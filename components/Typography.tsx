import { Text as RNText, StyleSheet, TextStyle } from 'react-native';
import { Colors } from '../constants/Theme';

interface Props {
  variant?: 'h1' | 'h2' | 'body' | 'caption' | 'label' | 'price';
  style?: TextStyle | TextStyle[];
  children: React.ReactNode;
  color?: string;
  numberOfLines?: number;
}

export const Typography = ({ variant = 'body', style, children, color, numberOfLines }: Props) => {
  return (
    <RNText 
        numberOfLines={numberOfLines}
        style={[styles[variant], color ? { color } : {}, style]}
    >
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  h1: {
    fontFamily: 'Inter',
    fontSize: 34, // iOS Large Title
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -1,
  },
  h2: {
    fontFamily: 'Inter',
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  price: {
    fontFamily: 'Inter',
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  body: {
    fontFamily: 'Inter',
    fontSize: 17, // iOS Body size
    color: Colors.text,
    lineHeight: 22,
  },
  caption: {
    fontFamily: 'Inter',
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  label: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: Colors.textSecondary,
  },
});
