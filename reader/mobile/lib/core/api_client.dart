import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'config.dart';
import 'token_storage.dart';

/// Emits whenever the API rejects our token, so the app can sign out.
final sessionExpiredController = StreamController<void>.broadcast();

final dioProvider = Provider<Dio>((ref) {
  final storage = ref.watch(tokenStorageProvider);
  final dio = Dio(BaseOptions(
    baseUrl: apiBaseUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 30),
    headers: {'Accept': 'application/json'},
  ));

  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) async {
      final token = await storage.read();
      if (token != null && !options.headers.containsKey('Authorization')) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      handler.next(options);
    },
    onError: (error, handler) {
      final sentToken = error.requestOptions.headers.containsKey('Authorization');
      final isAuthCall = error.requestOptions.path.contains('/api/auth/login') ||
          error.requestOptions.path.contains('/api/auth/register');
      if (error.response?.statusCode == 401 && sentToken && !isAuthCall) {
        sessionExpiredController.add(null);
      }
      handler.next(error);
    },
  ));
  return dio;
});

/// A user-facing message for any error thrown by an API call.
String errorMessage(Object error, [String fallback = 'Something went wrong. Please try again.']) {
  if (error is DioException) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
        return 'The request timed out. Please try again.';
      case DioExceptionType.connectionError:
        return 'Could not reach the server. Check your connection.';
      default:
        break;
    }
    final data = error.response?.data;
    if (data is Map && data['message'] is String) return data['message'] as String;
    return fallback;
  }
  return fallback;
}

/// Absolute URL for files served by the API (e.g. uploaded avatars).
String? assetUrl(String? path) {
  if (path == null || path.isEmpty) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return '$apiBaseUrl$path';
}

final _openLibraryCover = RegExp(r'covers\.openlibrary\.org/b/id/(\d+)-[SML]\.jpg');

/// Cover URL routed through the API's cover cache (Open Library is very slow).
/// size: 'S', 'M' (cards) or 'L' (large covers).
String? coverUrl(String? url, [String size = 'M']) {
  if (url == null || url.isEmpty) return null;
  final match = _openLibraryCover.firstMatch(url);
  if (match == null) return url;
  return '$apiBaseUrl/api/covers/${match.group(1)}-$size.jpg';
}
