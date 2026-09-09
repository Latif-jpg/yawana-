import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react-native';

import { Colors, Radius, Shadows, Spacing } from '@/constants/Theme';
import { Typography } from '@/components/Typography';

type ToastTone = 'success' | 'error' | 'info';

type ToastPayload = {
  tone?: ToastTone;
  title?: string;
  message: string;
  durationMs?: number;
};

type ToastState = Required<ToastPayload>;

type ToastContextValue = {
  showToast: (payload: ToastPayload) => void;
  hideToast: () => void;
};

const DEFAULT_DURATION_MS = 3200;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (payload: ToastPayload) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const nextToast: ToastState = {
        tone: payload.tone ?? 'info',
        title: payload.title ?? '',
        message: payload.message,
        durationMs: payload.durationMs ?? DEFAULT_DURATION_MS,
      };

      setToast(nextToast);
      timeoutRef.current = setTimeout(() => {
        setToast(null);
        timeoutRef.current = null;
      }, nextToast.durationMs);
    },
    []
  );

  const value = useMemo(() => ({ showToast, hideToast }), [hideToast, showToast]);

  const icon =
    toast?.tone === 'success' ? (
      <CheckCircle2 size={18} color={Colors.emerald} />
    ) : toast?.tone === 'error' ? (
      <TriangleAlert size={18} color={Colors.error} />
    ) : (
      <Info size={18} color={Colors.primary} />
    );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={styles.overlay}>
          <Animated.View
            entering={FadeInDown.duration(220)}
            exiting={FadeOutUp.duration(180)}
            style={[
              styles.toast,
              toast.tone === 'success'
                ? styles.toastSuccess
                : toast.tone === 'error'
                ? styles.toastError
                : styles.toastInfo,
            ]}
          >
            <View style={styles.iconWrap}>{icon}</View>
            <View style={styles.content}>
              {toast.title ? (
                <Typography variant="caption" style={styles.title}>
                  {toast.title}
                </Typography>
              ) : null}
              <Typography variant="caption" color={Colors.text} style={styles.message}>
                {toast.message}
              </Typography>
            </View>
            <TouchableOpacity onPress={hideToast} hitSlop={10}>
              <X size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 18,
    left: 12,
    right: 12,
    zIndex: 999,
  },
  toast: {
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    ...Shadows.premium,
  },
  toastSuccess: {
    backgroundColor: '#08170E',
    borderColor: Colors.emerald + '55',
  },
  toastError: {
    backgroundColor: '#1B0A0A',
    borderColor: Colors.error + '55',
  },
  toastInfo: {
    backgroundColor: '#07131F',
    borderColor: Colors.primary + '55',
  },
  iconWrap: {
    marginTop: 2,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: Colors.text,
    fontWeight: '800',
  },
  message: {
    lineHeight: 18,
  },
});
