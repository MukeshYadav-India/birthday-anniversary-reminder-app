import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

const VAPID_PUBLIC_KEY_STORAGE = 'vapid_public_key';

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

// ─────────────────────────────────────────────
//  WEB PUSH  (browser / PWA)
// ─────────────────────────────────────────────

async function getVapidPublicKey(): Promise<string | null> {
  // 1. Check localStorage cache
  const cached = localStorage.getItem(VAPID_PUBLIC_KEY_STORAGE);
  if (cached) return cached;

  // 2. Use the build-time env variable if set (add VITE_VAPID_PUBLIC_KEY to your .env)
  const envKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (envKey) {
    localStorage.setItem(VAPID_PUBLIC_KEY_STORAGE, envKey);
    return envKey;
  }

  // 3. Fall back to fetching from the edge function
  try {
    const { data, error } = await supabase.functions.invoke('generate-vapid-keys', {
      method: 'POST',
    });
    if (error) throw error;
    if (data?.publicKey) {
      localStorage.setItem(VAPID_PUBLIC_KEY_STORAGE, data.publicKey);
      return data.publicKey;
    }
  } catch (e) {
    console.error('Failed to get VAPID public key:', e);
  }
  return null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeWebPush(userId: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Web Push not supported in this browser');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) {
      console.error('No VAPID public key available');
      return false;
    }

    const pm = (registration as any).pushManager;
    let subscription = await pm.getSubscription();
    if (!subscription) {
      subscription = await pm.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const subJson = subscription.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: subJson.endpoint!,
      p256dh: subJson.keys!.p256dh,
      auth: subJson.keys!.auth,
    }, { onConflict: 'user_id,endpoint' });

    if (error) throw error;
    return true;
  } catch (e) {
    console.error('Failed to subscribe to web push:', e);
    return false;
  }
}

async function unsubscribeWebPush(userId: string): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await (registration as any).pushManager.getSubscription();
  if (subscription) {
    const endpoint = subscription.toJSON().endpoint;
    await subscription.unsubscribe();
    await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
  }
}

async function isWebPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await (registration as any).pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.error('Service Worker registration failed:', err);
    });
  }
}

// ─────────────────────────────────────────────
//  NATIVE PUSH  (iOS / Android via Capacitor)
// ─────────────────────────────────────────────

async function subscribeNativePush(userId: string): Promise<boolean> {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.warn('Push notification permission denied');
      return false;
    }

    // Listeners must be added BEFORE register() so the token event isn't missed
    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const settle = (val: boolean) => { if (!resolved) { resolved = true; resolve(val); } };

      // 30s covers: FCM registration + Supabase save (emulator can be slow).
      const timer = setTimeout(() => settle(false), 30_000);

      Promise.all([
        PushNotifications.addListener('registration', async (token) => {
          const { error } = await supabase.from('push_subscriptions').upsert({
            user_id: userId,
            endpoint: token.value,
            p256dh: null,
            auth: null,
            platform: Capacitor.getPlatform(),
          }, { onConflict: 'user_id,endpoint' });
          clearTimeout(timer);
          if (error) console.error('Failed to save native push token:', JSON.stringify(error));
          settle(!error);
        }),
        PushNotifications.addListener('registrationError', (err) => {
          clearTimeout(timer);
          console.error('Native push registration error:', err);
          settle(false);
        }),
      ]).then(() => {
        PushNotifications.register().catch(() => { clearTimeout(timer); settle(false); });
      });
    });
  } catch (e) {
    console.error('Failed to initialise native push:', e);
    return false;
  }
}

async function isNativePushSubscribed(): Promise<boolean> {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const result = await PushNotifications.checkPermissions();
    return result.receive === 'granted';
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
//  PUBLIC API  (platform-transparent)
// ─────────────────────────────────────────────

export async function subscribeToPush(userId: string): Promise<boolean> {
  if (isNativePlatform()) {
    return subscribeNativePush(userId);
  }
  return subscribeWebPush(userId);
}

export async function unsubscribeFromPush(userId: string): Promise<void> {
  if (isNativePlatform()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.removeAllDeliveredNotifications();
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .in('platform', ['android', 'ios']);
    } catch (e) {
      console.error('Native unsubscribe error:', e);
    }
  } else {
    await unsubscribeWebPush(userId);
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (isNativePlatform()) {
    return isNativePushSubscribed();
  }
  return isWebPushSubscribed();
}
