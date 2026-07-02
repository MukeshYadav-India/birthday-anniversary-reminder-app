/**
 * appInit.ts
 *
 * Capacitor native initialization — runs once at app startup.
 * Safely ignored when the app is running in a plain browser (isNativePlatform() → false).
 */

import { Capacitor } from '@capacitor/core';

export async function initNativeApp(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  await Promise.all([
    initSplashScreen(),
    initStatusBar(),
    initNotificationChannels(),
    initPushNotificationListeners(),
    initAppListeners(),
  ]);
}

// ─── Splash Screen ───────────────────────────────────────────────────────────

async function initSplashScreen(): Promise<void> {
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch (e) {
    console.warn('SplashScreen plugin not available:', e);
  }
}

// ─── Status Bar ──────────────────────────────────────────────────────────────

async function initStatusBar(): Promise<void> {
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Light });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#ffffff' });
    }
  } catch (e) {
    console.warn('StatusBar plugin not available:', e);
  }
}

// ─── Notification Channels (Android 8+) ──────────────────────────────────────

async function initNotificationChannels(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.createChannel({
      id: 'reminders',
      name: 'Event Reminders',
      description: 'Reminders for upcoming birthdays, anniversaries, and special events',
      importance: 4,
      sound: 'default',
      vibration: true,
      visibility: 1,
    });
  } catch (e) {
    console.warn('Could not create notification channel:', e);
  }
}

// ─── Push Notification Listeners ─────────────────────────────────────────────

async function initPushNotificationListeners(): Promise<void> {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Called when user taps a push notification while the app is in the background
    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push notification tapped:', notification);
      // You can navigate to a specific route here, e.g.:
      //   window.location.hash = '/';
    });

    // Called when a push is received while the app is open
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received (foreground):', notification);
    });
  } catch (e) {
    console.warn('PushNotifications plugin not available:', e);
  }
}

// ─── App Lifecycle (back button, URL open) ───────────────────────────────────

async function initAppListeners(): Promise<void> {
  try {
    const { App } = await import('@capacitor/app');

    // Handle deep links — required for Supabase email magic links / OAuth redirects
    App.addListener('appUrlOpen', (data) => {
      const url = new URL(data.url);
      // Forward the hash/query params into the React Router so auth callbacks work
      const path = url.pathname + url.search + url.hash;
      if (path && path !== '/') {
        window.history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    });

    // Android back button — exit app when on root route
    App.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        App.exitApp();
      } else {
        window.history.back();
      }
    });
  } catch (e) {
    console.warn('App plugin not available:', e);
  }
}
