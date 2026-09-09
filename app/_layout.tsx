import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '@/libs/auth';
import { Component, useEffect } from 'react';
import { View } from 'react-native';
import { registerForPushNotificationsAsync, savePushToken } from '@/libs/notifications';
import { ToastProvider } from '@/components/ToastProvider';
import { Button } from '@/components/Button';
import { Typography } from '@/components/Typography';
import { Colors } from '@/constants/Theme';

const queryClient = new QueryClient();

class RootErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || 'Une erreur est survenue au démarrage.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('[RootErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Typography variant="h2" style={{ textAlign: 'center', marginBottom: 12 }}>
            Yawana a rencontré un problème
          </Typography>
          <Typography variant="body" color={Colors.textSecondary} style={{ textAlign: 'center', marginBottom: 24 }}>
            {this.state.message}
          </Typography>
          <Button title="Relancer l app" onPress={() => this.setState({ hasError: false, message: '' })} />
        </View>
      );
    }

    return this.props.children;
  }
}

function NotificationManager() {
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;

    if (user) {
      (async () => {
        try {
          const token = await registerForPushNotificationsAsync();
          if (!cancelled && token) {
            await savePushToken(user.id, token);
          }
        } catch (error) {
          console.warn('Push registration skipped:', error);
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [user]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <AuthProvider>
              <NotificationManager />
              <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)/login" options={{ presentation: 'modal' }} />
              <Stack.Screen name="chat" options={{ headerShown: false }} />
              <Stack.Screen name="messages" options={{ headerShown: false }} />
            </Stack>
          </AuthProvider>
        </ToastProvider>
        </QueryClientProvider>
      </RootErrorBoundary>
    </GestureHandlerRootView>
  );
}
