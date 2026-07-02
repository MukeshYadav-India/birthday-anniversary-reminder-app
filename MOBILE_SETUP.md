# Cherish Reminders — Mobile App Setup & Publishing Guide

This guide walks you through everything needed to build and publish the app
to the **Google Play Store** (Android) and **Apple App Store** (iOS).

The project uses **Capacitor 8** — it wraps the React web app in a native
WebView shell, so the same codebase runs on both platforms.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Install Capacitor Plugins](#2-install-capacitor-plugins)
3. [Add Native Platforms](#3-add-native-platforms)
4. [Build & Sync the Web App](#4-build--sync-the-web-app)
5. [Android Setup (Google Play)](#5-android-setup)
6. [iOS Setup (Apple App Store)](#6-ios-setup)
7. [Push Notifications](#7-push-notifications)
8. [App Icons & Splash Screens](#8-app-icons--splash-screens)
9. [Publishing to Google Play](#9-publishing-to-google-play)
10. [Publishing to Apple App Store](#10-publishing-to-apple-app-store)

---

## 1. Prerequisites

### Software

| Tool | Version | Where to get it |
|------|---------|-----------------|
| Node.js | ≥ 18 | https://nodejs.org |
| Android Studio | Latest | https://developer.android.com/studio |
| Xcode (Mac only) | ≥ 15 | Mac App Store |
| CocoaPods (Mac only) | Latest | `sudo gem install cocoapods` |

> **iOS builds require a Mac.** Android builds can be done on Windows, Mac, or Linux.

### Developer Accounts

| Store | Cost | Link |
|-------|------|------|
| Google Play Console | $25 one-time | https://play.google.com/console |
| Apple Developer Program | $99/year | https://developer.apple.com/programs |

---

## 2. Install Capacitor Plugins

Run this once from the project root:

```bash
npm install
# The new packages are already listed in package.json:
#   @capacitor/app
#   @capacitor/push-notifications
#   @capacitor/splash-screen
#   @capacitor/status-bar
```

---

## 3. Add Native Platforms

Run these commands from the project root:

```bash
# Android (works on Windows / Mac / Linux)
npx cap add android

# iOS (Mac only)
npx cap add ios
```

This creates `android/` and `ios/` folders containing the native projects.

> These folders are generated code — it's fine to commit them or add them
> to `.gitignore`. If you commit them, teammates don't need to re-run these commands.

---

## 4. Build & Sync the Web App

Every time you change the React source, run:

```bash
npm run cap:sync
# This is a shorthand for: npm run build && npx cap sync
```

`npx cap sync` copies your compiled `dist/` files into the native projects
and updates any plugin bridging code.

---

## 5. Android Setup

### Open in Android Studio

```bash
npm run cap:android
# Equivalent to: npm run build && npx cap sync && npx cap open android
```

Android Studio will open. Wait for Gradle to sync (bottom progress bar).

### First-time Android Studio setup

1. Accept the Android SDK licence when prompted.
2. In **File → Project Structure → SDK Location**, confirm the Android SDK path is set.
3. Connect a physical Android device with USB debugging enabled, **or** create
   an emulator via **Device Manager → Create Virtual Device**.

### Run the app on device / emulator

Press the green ▶ **Run** button in Android Studio.

### Change the App ID

The App ID is set in `capacitor.config.ts` → `appId: 'com.cherishreminders.app'`.

You can change it to anything in reverse-domain style (e.g. `com.yourname.cherishreminders`).
After changing it, re-run `npx cap sync` and then in Android Studio:
- Open `android/app/build.gradle`
- Confirm `applicationId` matches your chosen ID.

---

## 6. iOS Setup

> Requires a Mac with Xcode installed.

### Open in Xcode

```bash
npm run cap:ios
# Equivalent to: npm run build && npx cap sync && npx cap open ios
```

### Configure signing

1. In Xcode, click the **App** target in the left sidebar.
2. Under **Signing & Capabilities**, select your Apple Developer Team.
3. Xcode will auto-generate a provisioning profile.

### Run on a physical iPhone

1. Connect your iPhone via USB.
2. Trust the Mac on the device when prompted.
3. Select your device in the Xcode toolbar and press ▶.

---

## 7. Push Notifications

Push notifications require extra configuration per platform.

### Android — Firebase Cloud Messaging (FCM)

1. Go to https://console.firebase.google.com and create a project.
2. Add an **Android app** with the package name `com.cherishreminders.app`.
3. Download `google-services.json` and place it in `android/app/`.
4. In `android/build.gradle`, add inside `dependencies`:
   ```groovy
   classpath 'com.google.gms:google-services:4.4.2'
   ```
5. In `android/app/build.gradle`, add at the bottom:
   ```groovy
   apply plugin: 'com.google.gms.google-services'
   ```
6. Sync Gradle in Android Studio.

The FCM token is automatically captured in `src/lib/push.ts` and saved to Supabase.

### iOS — APNs (Apple Push Notification service)

1. In your Apple Developer account, create an **APNs Key** (or use a certificate).
2. In Xcode → **Signing & Capabilities**, click **+ Capability** and add
   **Push Notifications** and **Background Modes → Remote notifications**.
3. In your Supabase project (or your push-sending backend), configure the APNs
   key/certificate to send notifications to iOS devices.

---

## 8. App Icons & Splash Screens

### Recommended tool: `@capacitor/assets`

```bash
npm install -D @capacitor/assets

# Create a single source image (1024×1024 px, no rounded corners — the OS handles that):
# Save it as: resources/icon.png

# Create a splash screen source (2732×2732 px):
# Save it as: resources/splash.png

# Then generate all sizes automatically:
npx capacitor-assets generate
```

This creates all required icon and splash screen sizes for both Android and iOS.

---

## 9. Publishing to Google Play

### Generate a signed AAB (Android App Bundle)

1. In Android Studio: **Build → Generate Signed Bundle / APK**.
2. Choose **Android App Bundle**.
3. Create a new keystore (`.jks` file) — **keep this file safe, you can never replace it**.
4. Fill in the keystore details and click **Next → Finish**.
5. The `.aab` file will be in `android/app/release/`.

### Upload to Google Play Console

1. Log in to https://play.google.com/console.
2. Create a new app.
3. Fill in: store listing (title, description, screenshots), content rating, privacy policy URL.
4. Under **Release → Production**, upload your `.aab` file.
5. Submit for review (~3 days for a new app, faster for updates).

---

## 10. Publishing to Apple App Store

### Archive the app in Xcode

1. In Xcode, set the scheme to **Any iOS Device (arm64)** (not a simulator).
2. **Product → Archive**.
3. In the Organiser window that opens, click **Distribute App**.
4. Choose **App Store Connect → Upload**.
5. Follow the prompts to sign and upload.

### Submit in App Store Connect

1. Log in to https://appstoreconnect.apple.com.
2. Create a new app, enter your App ID (`com.cherishreminders.app`).
3. Fill in: description, keywords, screenshots for iPhone and iPad.
4. Under **TestFlight**, you can distribute to testers before a public release.
5. Submit for review (~1–2 days typically).

---

## Quick Reference — Common Commands

```bash
# Install all dependencies (including new Capacitor plugins)
npm install

# Build web app and sync to native projects
npm run cap:sync

# Open Android project in Android Studio
npm run cap:android

# Open iOS project in Xcode (Mac only)
npm run cap:ios

# Add native platforms (only needed once)
npx cap add android
npx cap add ios

# Generate app icons and splash screens (after adding resources/icon.png)
npx capacitor-assets generate
```

---

## Troubleshooting

**"Gradle sync failed"** — Open Android Studio, go to File → Invalidate Caches, restart.

**"No provisioning profile"** — In Xcode Signing settings, make sure a Team is selected and auto-signing is on.

**White screen on device** — Run `npm run build` again and then `npx cap sync`; the old `dist/` may have been stale.

**Push not working on Android** — Make sure `google-services.json` is in `android/app/` and Gradle has applied the plugin.

**Deep links / auth redirects not working** — Add `com.cherishreminders.app` as a redirect URL in your Supabase project settings under **Authentication → URL Configuration**.
