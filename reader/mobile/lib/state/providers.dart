import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../core/api_client.dart';
import '../core/token_storage.dart';
import '../data/reader_api.dart';
import '../models/models.dart';

// ---------------------------------------------------------------------------
// Session

Map<String, dynamic> _userToJson(AppUser u) => {
      '_id': u.id,
      'name': u.name,
      'email': u.email,
      'avatar': u.avatar ?? '',
      'customShelves': u.customShelves,
    };

class AuthController extends AsyncNotifier<AppUser?> {
  @override
  Future<AppUser?> build() async {
    final sub = sessionExpiredController.stream.listen((_) => logout());
    ref.onDispose(sub.cancel);

    final storage = ref.read(tokenStorageProvider);
    final token = await storage.read();
    if (token == null) return null;

    final cached = await storage.readUser();
    try {
      final fresh = await ref.read(apiProvider).profile();
      await storage.writeUser(_userToJson(fresh));
      return fresh;
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        await storage.clear();
        return null;
      }
      // Offline or server unreachable: keep the session with the cached profile
      return cached == null ? null : AppUser.fromJson(cached);
    }
  }

  Future<void> _signIn(AppUser user) async {
    final storage = ref.read(tokenStorageProvider);
    if (user.token != null) await storage.write(user.token!);
    await storage.writeUser(_userToJson(user));
    state = AsyncData(user);
  }

  Future<void> login(String email, String password) async {
    final user = await ref.read(apiProvider).login(email.trim(), password);
    await _signIn(user);
  }

  Future<void> register(String name, String email, String password) async {
    final user = await ref.read(apiProvider).register(name.trim(), email.trim(), password);
    await _signIn(user);
  }

  /// Returns false if the user closed the Google account picker.
  Future<bool> loginWithGoogle() async {
    final clientId = await ref.read(googleClientIdProvider.future);
    if (clientId == null) throw const GoogleSignInUnavailable();
    final google = GoogleSignIn.instance;
    try {
      try {
        _googleInit ??= google.initialize(serverClientId: clientId);
        await _googleInit;
      } catch (_) {
        _googleInit = null; // Let the next tap try again
        rethrow;
      }
      final account = await google.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null) throw const GoogleSignInUnavailable();
      await _signIn(await ref.read(apiProvider).googleLogin(idToken));
      return true;
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled || e.code == GoogleSignInExceptionCode.interrupted) return false;
      debugPrint('Google sign-in failed: ${e.code} ${e.description}');
      throw const GoogleSignInUnavailable();
    }
  }

  Future<void> updateUser(AppUser user) async {
    if (user.token != null) await ref.read(tokenStorageProvider).write(user.token!);
    await ref.read(tokenStorageProvider).writeUser(_userToJson(user));
    state = AsyncData(user);
  }

  Future<void> logout() async {
    await ref.read(tokenStorageProvider).clear();
    state = const AsyncData(null);
    // Forget the Google account too, so the next sign-in offers the account picker
    if (_googleInit != null) unawaited(GoogleSignIn.instance.signOut().catchError((_) {}));
  }
}

Future<void>? _googleInit;

class GoogleSignInUnavailable implements Exception {
  const GoogleSignInUnavailable();
  @override
  String toString() => 'Google sign-in is not available right now. Please use your email and password.';
}

/// The server's Google OAuth client ID; null when Google sign-in is turned off
/// or the server can't be reached (re-checked each time a sign-in screen opens).
final googleClientIdProvider = FutureProvider.autoDispose<String?>((ref) async {
  try {
    return await ref.watch(apiProvider).googleClientId();
  } catch (_) {
    return null;
  }
});

final authProvider = AsyncNotifierProvider<AuthController, AppUser?>(AuthController.new);

/// The signed-in user, or null (also null while the session is loading).
final currentUserProvider = Provider<AppUser?>((ref) => ref.watch(authProvider).value);

// ---------------------------------------------------------------------------
// Theme

class ThemeController extends Notifier<ThemeMode> {
  @override
  ThemeMode build() {
    _load();
    return ThemeMode.system;
  }

  Future<void> _load() async {
    final saved = await ref.read(tokenStorageProvider).readTheme();
    final mode = ThemeMode.values.where((m) => m.name == saved).firstOrNull;
    if (mode != null) state = mode;
  }

  Future<void> set(ThemeMode mode) async {
    state = mode;
    await ref.read(tokenStorageProvider).writeTheme(mode.name);
  }
}

final themeModeProvider = NotifierProvider<ThemeController, ThemeMode>(ThemeController.new);

// ---------------------------------------------------------------------------
// Data

final bookProvider = FutureProvider.autoDispose.family<Book, String>((ref, id) => ref.watch(apiProvider).book(id));

// Independent of bookProvider so refreshing the book (e.g. after posting a
// review) doesn't reload the description and shift the page. The endpoint
// returns a stored description immediately and fetches it only once.
final bookDescriptionProvider = FutureProvider.autoDispose.family<String, String>(
  (ref, id) => ref.watch(apiProvider).description(id),
);

final reviewsProvider = FutureProvider.autoDispose.family<List<Review>, String>((ref, id) => ref.watch(apiProvider).reviews(id));

final bookTagsProvider = FutureProvider.autoDispose.family<List<TagCount>, String>((ref, id) {
  ref.watch(currentUserProvider.select((u) => u?.id)); // "mine" flags depend on who's signed in
  return ref.watch(apiProvider).bookTags(id);
});

final myShelfProvider = FutureProvider.autoDispose.family<ShelfEntry?, String>((ref, id) async {
  final userId = ref.watch(currentUserProvider.select((u) => u?.id));
  if (userId == null) return null;
  return ref.watch(apiProvider).myShelf(id);
});

final shelvesProvider = FutureProvider.autoDispose<List<ShelfEntry>>((ref) async {
  final userId = ref.watch(currentUserProvider.select((u) => u?.id));
  if (userId == null) return const [];
  return ref.watch(apiProvider).shelves();
});

// The feed and clubs show other members, so the API only serves them to signed-in users
final activitiesProvider = FutureProvider.autoDispose<List<Activity>>((ref) async {
  final userId = ref.watch(currentUserProvider.select((u) => u?.id));
  if (userId == null) return const [];
  return ref.watch(apiProvider).activities();
});

final clubsProvider = FutureProvider.autoDispose<List<BookClub>>((ref) async {
  final userId = ref.watch(currentUserProvider.select((u) => u?.id));
  if (userId == null) return const [];
  return ref.watch(apiProvider).clubs();
});

final readingActivityProvider = FutureProvider.autoDispose<ReadingActivity?>((ref) async {
  final userId = ref.watch(currentUserProvider.select((u) => u?.id));
  if (userId == null) return null;
  return ref.watch(apiProvider).readingActivity();
});

final challengeProvider = FutureProvider.autoDispose.family<ReadingChallenge?, int>((ref, year) async {
  final userId = ref.watch(currentUserProvider.select((u) => u?.id));
  if (userId == null) return null;
  return ref.watch(apiProvider).challenge(year);
});

final popularTagsProvider = FutureProvider.autoDispose.family<List<TagCount>, String>(
  (ref, query) => ref.watch(apiProvider).popularTags(query: query),
);
