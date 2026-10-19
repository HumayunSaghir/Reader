# Reader mobile (Android & iOS)

The Flutter app for Reader. It talks to the same Express API as the web app
(`../backend`), so features, accounts and data are shared.

| | |
|---|---|
| Framework | Flutter 3.47 (Dart 3.13) |
| State | Riverpod 3 |
| Navigation | go_router (bottom tabs: Home, Swipe, Clubs, My Books) |
| HTTP | Dio, with an auth interceptor and automatic sign-out on expired sessions |
| Storage | flutter_secure_storage (Keychain on iOS, Keystore on Android) for the session |
| Images | cached_network_image, with covers loaded through the API's `/api/covers` cache |

## Features

These match the web app:

- **Home:** trending and genre lists with infinite scroll, plus the community activity feed.
- **Search:** live suggestions as you type, then full ranked results.
- **Book page:**
  - shelf status and custom shelves
  - description and micro-trope tags with voting
  - AI "Should I read this?" and the Book Sommelier chat
  - reviews with likes and replies, and an AI review summary
- **Swipe:** a native card deck with drag, fling, undo and haptics, filtered by genre or trope.
- **Tropes:** browse books that match several tropes at once.
- **Book clubs:**
  - create a club, picking its book with search
  - join, track chapter progress and see each member's progress
  - chat with spoiler protection; new messages are polled while the screen is open
- **My Books:**
  - shelves (built-in and custom), with long-press to remove a book
  - reading streak with a 12-week heatmap and "I read today"
  - the yearly challenge with goal editing, and profile photo upload
- **General:** light, dark or system theme, pull-to-refresh everywhere, and skeleton loading states.

## Setup on this machine

These are already installed:

- **Flutter SDK:** `C:\Users\Max\dev\flutter`, on the user PATH.
- **Android SDK:** `%LOCALAPPDATA%\Android\Sdk`. It includes platform 36, build-tools 36.1.0, NDK 28.2 and the emulator. `ANDROID_HOME` is set.
- **JDK:** Java 21, with `JAVA_HOME` set.
- **Emulator:** an Android Virtual Device named `Reader_Pixel` (Pixel 7, Android 16), with hardware acceleration via WHPX.

Open a **new** terminal so the environment variables apply, then check the setup:

```bash
flutter doctor
```

## Running

1. Start the backend on port 5000: `cd ../backend && npm run dev`.
2. Start the emulator, or plug in a phone with USB debugging on:
   ```bash
   flutter emulators --launch Reader_Pixel
   ```
3. Run the app:
   ```bash
   flutter run
   ```

By default the app connects to your computer's backend:

- **Android emulator:** `http://10.0.2.2:5000`
- **iOS simulator:** `http://localhost:5000`

For a **physical Android phone over USB**, forward the phone's port 5000 to your
computer. You need to run `adb reverse` again each time the phone is reconnected.

```bash
adb reverse tcp:5000 tcp:5000
flutter run --release --dart-define=API_URL=http://localhost:5000
```

For a **phone on Wi-Fi**, use your computer's LAN IP with a debug build:

```bash
flutter run --dart-define=API_URL=http://192.168.1.20:5000
```

Debug builds allow plain HTTP to any address. Release builds require HTTPS, except
for `localhost` and `10.0.2.2`. These rules are in `android/app/src/*/res/xml/network_security_config.xml`.

Debug builds are much slower than release builds, so scrolling stutters in them.
To judge how smooth the app feels, use `--release` or `--profile`.

## Sign in with Google

The button appears only when the backend has `GOOGLE_CLIENT_ID` set. The app
fetches the client ID from `/api/auth/google/config`. To set it up:

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   configure the OAuth consent screen.
2. Create an OAuth client ID of type **Web application**. Put its client ID in
   the backend `.env` as `GOOGLE_CLIENT_ID`.
3. Create an OAuth client ID of type **Android** with:
   - package name `com.readerapp.reader_mobile`
   - the SHA-1 of the key that signs the app. Get it with
     `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`.
     When you add a release key, register its SHA-1 as well. For Play Store
     builds, also register the Play App Signing SHA-1.
4. For iOS, create an **iOS** client. Add its client ID as `GIDClientID` in
   `ios/Runner/Info.plist`, and its reversed client ID as a URL scheme.

The backend verifies Google's ID token and signs the user in. If the email
already belongs to a Reader account, it links to that account. Otherwise it
creates a new account.

## Building for release

Always pass your production API URL:

```bash
# Android: App Bundle for Google Play, or an APK for direct installs
flutter build appbundle --dart-define=API_URL=https://api.yourdomain.com
flutter build apk --release --dart-define=API_URL=https://api.yourdomain.com

# iOS: requires macOS with Xcode
flutter build ipa --dart-define=API_URL=https://api.yourdomain.com
```

Before publishing:

- **Android signing:** create an upload keystore and configure `signingConfigs` in
  `android/app/build.gradle.kts`. Release builds currently use the debug key.
- **App ID:** `com.readerapp.reader_mobile`. Change `applicationId` (Android) and the
  bundle identifier (Xcode) to your own before the first store upload.
- **Icons and splash:** replace the default Flutter icons, for example with `flutter_launcher_icons`.
- **Backend:** add your API domain to `CORS_ORIGIN` only if you also serve the web app. The
  mobile app isn't subject to CORS.

### iOS needs a Mac

Flutter compiles iOS apps only on macOS with Xcode. The code and the
`ios/` project are ready. On a Mac, run `flutter build ipa` (or open
`ios/Runner.xcworkspace` in Xcode), set your signing team, and archive.
Without a Mac, a cloud CI service with macOS runners (such as Codemagic or
GitHub Actions `macos-latest`) can build and upload it.

## Project layout

```
lib/
  core/       config (API URL), API client, token storage, theme, router
  data/       ReaderApi: one typed method per backend endpoint
  models/     JSON models (Book, Review, BookClub...)
  state/      Riverpod providers (session, theme, cached queries)
  widgets/    shared UI (covers, book cards, skeletons, empty and error states)
  features/   screens: home, search, books, discover, tags, clubs, profile, auth
```

Checks: `flutter analyze` and `flutter test`.

## Notes for this machine (about 8 GB RAM)

- Gradle's heap is set to 2 GB in `android/gradle.properties`. The Flutter template default
  of 8 GB is more than this PC has and made builds swap heavily.
- The first Android build takes 10–20 minutes, mostly downloads. Later builds take about a minute.
- Avoid running a Gradle build and the emulator at the same time: the emulator can
  be killed for lack of memory. If the emulator struggles, a real phone over
  USB is faster.
- Kotlin incremental compilation is disabled in `android/gradle.properties`. On Windows it
  fails when the project (E:) and the pub cache (C:) are on different drives.
