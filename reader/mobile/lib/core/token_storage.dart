import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Session storage backed by the platform keychain (iOS) / keystore (Android).
/// Holds the auth token plus a cached copy of the user's profile so the app
/// can open signed-in while offline.
class TokenStorage {
  TokenStorage(this._storage);

  final FlutterSecureStorage _storage;
  static const _tokenKey = 'auth_token';
  static const _userKey = 'auth_user';
  static const _themeKey = 'theme_mode';
  String? _cached;
  bool _loaded = false;

  Future<String?> _safeRead(String key) async {
    try {
      return await _storage.read(key: key);
    } catch (_) {
      // A corrupted keystore entry shouldn't crash the app
      return null;
    }
  }

  Future<String?> read() async {
    if (_loaded) return _cached;
    _cached = await _safeRead(_tokenKey);
    _loaded = true;
    return _cached;
  }

  Future<void> write(String token) async {
    _cached = token;
    _loaded = true;
    await _storage.write(key: _tokenKey, value: token);
  }

  Future<Map<String, dynamic>?> readUser() async {
    final raw = await _safeRead(_userKey);
    if (raw == null) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<void> writeUser(Map<String, dynamic> user) => _storage.write(key: _userKey, value: jsonEncode(user));

  Future<String?> readTheme() => _safeRead(_themeKey);

  Future<void> writeTheme(String mode) => _storage.write(key: _themeKey, value: mode);

  Future<void> clear() async {
    _cached = null;
    _loaded = true;
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userKey);
  }
}

final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage(const FlutterSecureStorage()));
