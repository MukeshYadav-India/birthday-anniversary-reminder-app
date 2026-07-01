import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY_STORAGE = 'vapid_public_key';

export async function getVapidPublicKey(): Promise<string | null> {
  // Try cache first
  const cached = localStorage.getItem(VAPID_PUBLIC_KEY_STORAGE);
  if (cached) return cached;

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

export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported');
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
    console.error('Failed to subscribe to push:', e);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await (registration as any).pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }
}

export async function isPushSubscribed(): Promise<boolean> {
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
