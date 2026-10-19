import 'package:flutter/foundation.dart';

/// API base URL.
///
/// Set it at build time for real devices and production:
///   flutter run --dart-define=API_URL=https://api.example.com
///
/// Defaults reach a backend running on your development machine:
/// - Android emulator: 10.0.2.2 is the host machine's localhost
/// - iOS simulator, web, desktop: localhost
const _apiUrlFromEnv = String.fromEnvironment('API_URL');

String get apiBaseUrl {
  if (_apiUrlFromEnv.isNotEmpty) return _apiUrlFromEnv.replaceAll(RegExp(r'/+$'), '');
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
    return 'http://10.0.2.2:5000';
  }
  return 'http://localhost:5000';
}
