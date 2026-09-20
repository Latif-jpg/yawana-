import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase'; // Ajustez le chemin selon votre structure
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'web') return null;

  if (Platform.OS === 'android') {
    // Android push requires Firebase/FCM in the dev client. Keep startup silent
    // until that native configuration is present; this is not a runtime error.
    return null;
  }

  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    // Project ID est requis pour les nouvelles versions de Expo
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (error: any) {
    const message = String(error?.message || error?.code || '');
    if (message.toLowerCase().includes('firebaseapp') || message.toLowerCase().includes('fcm')) {
      console.warn('Push notifications skipped: Firebase/FCM is not initialized for this build.');
      return null;
    }

    console.warn('Push notifications skipped:', error);
    return null;
  }

  return token;
}

export async function savePushToken(userId: string, token: string) {
  if (!userId || !token) return;

  const { error } = await supabase
    .from('profiles')
    .update({ expo_push_token: token })
    .eq('id', userId);

  if (error) {
    console.error('Error saving push token:', error);
  } else {
    console.log('Push token saved successfully');
  }
}
