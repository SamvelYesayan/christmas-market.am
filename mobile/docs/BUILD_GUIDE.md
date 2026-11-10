# Build & run guide

## 1. Prerequisites

- Node 20+ (tested with Node 22) and npm.
- The Christmas Market backend running locally (repo root): PostgreSQL, then `npm run dev -w server` (API on port
  4000). Seed demo data with `npm run db:seed:demo` if needed. Demo customer: `demo@christmas-market.test` /
  `snowflake-demo-2026`.
- For a phone: the **Expo Go** app (SDK 58) or a development build (below). For Android emulators: Android Studio
  with a system image + JDK 17. For iOS simulators/builds: a Mac with Xcode (or EAS Build in the cloud).

## 2. Install

```bash
cd mobile
npm install
```

`mobile/` is not part of the root npm workspaces — always install from inside `mobile/`. Use `npx expo install
<pkg>` to add libraries (it picks SDK-compatible versions).

## 3. Backend URL

The app needs the API origin (without `/api/v1`):

| Where the app runs | URL |
|---|---|
| Physical phone (Expo Go / dev build) on the same Wi-Fi | **leave `EXPO_PUBLIC_API_URL` empty** — the app uses the LAN IP of the computer running Expo, port 4000. Or set `http://<your-PC-LAN-IP>:4000`. Never `localhost` (that is the phone itself). |
| Android emulator | `http://10.0.2.2:4000` |
| iOS simulator | `http://localhost:4000` |
| Production | `https://christmas-market.am` |

```bash
cp .env.example .env.local     # git-ignored; EXPO_PUBLIC_* values are public, never put secrets here
```

Find your PC's LAN IP on Windows with `ipconfig` (IPv4 of the Wi-Fi adapter). Windows Defender Firewall must allow
inbound TCP 4000 (Node) and 8081 (Metro) on private networks. The API binds all interfaces by default.
`Settings → Server` in the app shows which API it is talking to.

## 4. Start

```bash
npx expo start
```

Then press `a` (Android emulator/device), `i` (iOS simulator, macOS), or scan the QR code with Expo Go (Android) /
the Camera app (iOS). If the phone cannot reach Metro on your network, use `npx expo start --tunnel`. To force the
LAN address: `npm run start:lan`.

### Expo Go vs development build

Everything the app uses (Router, Reanimated, Gesture Handler, SVG, SecureStore, Haptics, Image, Web Browser,
Notifications for **local** reminders) is available in Expo Go SDK 58, so Expo Go is enough for development.
Use a **development build** when you need: remote push notifications (not available in Expo Go on Android since
SDK 53), your own bundle id/app icon on the device, or production-like behaviour:

```bash
npx expo run:android      # needs Android Studio + JDK 17 locally
npx expo run:ios          # needs macOS + Xcode
# or in the cloud:
npx eas-cli@latest build --profile development --platform android
```

## 5. Checks

```bash
npm run typecheck          # tsc --noEmit
npm run lint               # expo lint (ESLint + React Compiler rules)
npm test                   # Jest (jest-expo), all APIs mocked
npm run validate:android   # bundles every route for Android with Metro/Hermes (no device needed)
npx expo-doctor            # dependency / config health
```

Optional live check of the app's API layer against your running backend (read-only except a guest cart line that
is removed again, plus a demo sign-in/out):

```bash
LIVE_API_URL=http://localhost:4000 npx jest __tests__/live.integration.test.ts
```

On Windows PowerShell: `$env:LIVE_API_URL='http://localhost:4000'; npx jest __tests__/live.integration.test.ts`.

## 6. Release builds (EAS)

1. `npx eas-cli@latest login` and `npx eas-cli@latest init` (adds `extra.eas.projectId` to the config).
2. Replace the placeholder identifiers in `app.json` if needed: iOS `bundleIdentifier` and Android `package` are
   `am.christmasmarket.app` (**placeholders — confirm the final ids before the first store upload; they cannot
   change afterwards**).
3. Set `EXPO_PUBLIC_API_URL=https://christmas-market.am` and `EXPO_PUBLIC_WEB_URL=https://christmas-market.am` for
   the build (EAS environment variables or `.env.production`).
4. `npx eas-cli@latest build --platform android --profile production` (AAB) and `--platform ios`.
5. Store listing assets and final icon artwork: `assets/` currently holds generated placeholder artwork
   (`node scripts/generate-icons.mjs`); replace with the final brand icon (1024×1024, no transparency for iOS).

## 7. Regenerating generated files

```bash
node scripts/port-art.mjs        # after changing client/src/art/Art.jsx
node scripts/generate-icons.mjs  # icons, adaptive icon layers, splash, notification icon, favicon
```

The website dictionaries `src/i18n/hy.web.ts` / `en.web.ts` are copies of `client/src/i18n/hy.js` / `en.js` —
copy them again after website text changes (a test checks both languages have the same keys).

## 8. Permissions

Android requests no dangerous permissions at install (`permissions: []`; audio/storage/overlay explicitly
blocked). Notification permission is asked only when the user turns on calendar reminders (Android 13+/iOS
runtime prompt). No camera, location, contacts or microphone access.
