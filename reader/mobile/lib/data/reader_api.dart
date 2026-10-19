import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../models/models.dart';

/// Typed access to every Reader API endpoint used by the app.
class ReaderApi {
  ReaderApi(this._dio);
  final Dio _dio;

  List<Map<String, dynamic>> _maps(dynamic data) =>
      data is List ? data.whereType<Map<String, dynamic>>().toList() : const [];

  // ---- Auth ----
  Future<AppUser> login(String email, String password) async {
    final res = await _dio.post('/api/auth/login', data: {'email': email, 'password': password});
    return AppUser.fromJson(res.data as Map<String, dynamic>);
  }

  Future<AppUser> register(String name, String email, String password) async {
    final res = await _dio.post('/api/auth/register', data: {'name': name, 'email': email, 'password': password});
    return AppUser.fromJson(res.data as Map<String, dynamic>);
  }

  /// The Google OAuth client to sign in with, or null when the server has Google sign-in off.
  Future<String?> googleClientId() async {
    final res = await _dio.get('/api/auth/google/config');
    final data = res.data as Map<String, dynamic>;
    return data['enabled'] == true ? data['clientId'] as String? : null;
  }

  Future<AppUser> googleLogin(String idToken) async {
    final res = await _dio.post('/api/auth/google', data: {'idToken': idToken});
    return AppUser.fromJson(res.data as Map<String, dynamic>);
  }

  Future<AppUser> profile() async {
    final res = await _dio.get('/api/auth/profile');
    return AppUser.fromJson(res.data as Map<String, dynamic>);
  }

  Future<AppUser> uploadPhoto(String filePath, String fileName) async {
    final form = FormData.fromMap({'photo': await MultipartFile.fromFile(filePath, filename: fileName)});
    final res = await _dio.put('/api/auth/profile/photo', data: form);
    return AppUser.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<String>> addCustomShelf(String name) async {
    final res = await _dio.post('/api/auth/profile/shelves', data: {'shelfName': name});
    return (res.data as List).whereType<String>().toList();
  }

  Future<List<String>> removeCustomShelf(String name) async {
    final res = await _dio.delete('/api/auth/profile/shelves/${Uri.encodeComponent(name)}');
    return (res.data as List).whereType<String>().toList();
  }

  // ---- Books ----
  Future<List<Book>> browse({String? category, int page = 1}) async {
    final res = await _dio.get('/api/books', queryParameters: {
      'page': page,
      if (category != null && category.isNotEmpty) 'category': category.toLowerCase(),
    });
    return _maps(res.data).map(Book.fromJson).toList();
  }

  Future<List<Book>> search(String query, {int page = 1}) async {
    final res = await _dio.get('/api/books/search', queryParameters: {'query': query, 'page': page});
    return _maps(res.data).map(Book.fromJson).toList();
  }

  Future<List<Book>> liveSearch(String query, {CancelToken? cancelToken}) async {
    final res = await _dio.get('/api/books/livesearch', queryParameters: {'query': query}, cancelToken: cancelToken);
    return _maps(res.data).map(Book.fromJson).toList();
  }

  Future<Book> book(String id) async {
    final res = await _dio.get('/api/books/$id');
    return Book.fromJson(res.data as Map<String, dynamic>);
  }

  Future<String> description(String id) async {
    final res = await _dio.get('/api/books/$id/description');
    return (res.data as Map)['description'] as String? ?? '';
  }

  // ---- Shelves ----
  Future<List<ShelfEntry>> shelves() async {
    final res = await _dio.get('/api/books/shelves');
    return _maps(res.data).map(ShelfEntry.fromJson).where((s) => s.book != null).toList();
  }

  Future<ShelfEntry> myShelf(String bookId) async {
    final res = await _dio.get('/api/books/$bookId/shelf');
    return ShelfEntry.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> setStatus(String bookId, ShelfStatus? status) =>
      _dio.post('/api/books/$bookId/shelf', data: {'status': status?.apiValue});

  Future<void> removeFromShelves(String bookId) => _dio.delete('/api/books/$bookId/shelf');

  Future<void> setCustomShelf(String bookId, String shelf, {required bool add}) =>
      _dio.post('/api/books/$bookId/shelf', data: {'customShelf': shelf, 'action': add ? 'add' : 'remove'});

  // ---- Reviews ----
  Future<List<Review>> reviews(String bookId) async {
    final res = await _dio.get('/api/books/$bookId/reviews');
    return _maps(res.data).map(Review.fromJson).toList();
  }

  Future<void> saveReview(String bookId, int rating, String text) =>
      _dio.post('/api/books/$bookId/reviews', data: {'rating': rating, 'reviewText': text});

  Future<void> deleteReview(String bookId, String reviewId) => _dio.delete('/api/books/$bookId/reviews/$reviewId');

  Future<void> toggleReviewLike(String bookId, String reviewId) => _dio.put('/api/books/$bookId/reviews/$reviewId/like');

  Future<void> reply(String bookId, String reviewId, String text) =>
      _dio.post('/api/books/$bookId/reviews/$reviewId/replies', data: {'text': text});

  Future<void> deleteReply(String bookId, String reviewId, String replyId) =>
      _dio.delete('/api/books/$bookId/reviews/$reviewId/replies/$replyId');

  // ---- AI ----
  Future<String> reviewSummary(String bookId) async {
    final res = await _dio.get('/api/books/$bookId/reviews/summary');
    return (res.data as Map)['summary'] as String? ?? '';
  }

  Future<String> recommendation(String bookId) async {
    final res = await _dio.get('/api/books/$bookId/recommendation');
    return (res.data as Map)['recommendation'] as String? ?? '';
  }

  /// history: [{role: 'user'|'model', content: '...'}]
  Future<String> chat(String bookId, String message, List<Map<String, String>> history) async {
    final res = await _dio.post('/api/books/$bookId/chat', data: {'message': message, 'history': history});
    return (res.data as Map)['reply'] as String? ?? '';
  }

  // ---- Tags ----
  Future<List<TagCount>> bookTags(String bookId) async {
    final res = await _dio.get('/api/books/$bookId/tags');
    return _maps(res.data).map(TagCount.fromJson).toList();
  }

  Future<List<TagCount>> addTag(String bookId, String tag) async {
    final res = await _dio.post('/api/books/$bookId/tags', data: {'tag': tag});
    return _maps(res.data).map(TagCount.fromJson).toList();
  }

  Future<List<TagCount>> removeTag(String bookId, String tag) async {
    final res = await _dio.delete('/api/books/$bookId/tags/${Uri.encodeComponent(tag)}');
    return _maps(res.data).map(TagCount.fromJson).toList();
  }

  Future<List<TagCount>> popularTags({String query = '', int limit = 40}) async {
    final res = await _dio.get('/api/tags', queryParameters: {'q': query, 'limit': limit});
    return _maps(res.data).map(TagCount.fromJson).toList();
  }

  Future<({List<Book> books, bool hasMore})> booksWithTags(List<String> tags, {int page = 1}) async {
    final res = await _dio.get('/api/tags/books', queryParameters: {'tags': tags.join(','), 'page': page});
    final data = res.data as Map<String, dynamic>;
    return (books: _maps(data['books']).map(Book.fromJson).toList(), hasMore: data['hasMore'] == true);
  }

  // ---- Discover ----
  Future<List<Book>> discoverQueue({String? category, List<String> tags = const [], List<String> exclude = const []}) async {
    final res = await _dio.get('/api/books/discover', queryParameters: {
      'limit': 20,
      if (tags.isNotEmpty) 'tags': tags.join(','),
      if (tags.isEmpty && category != null) 'category': category.toLowerCase(),
      if (exclude.isNotEmpty) 'exclude': exclude.join(','),
    });
    return _maps(res.data).map(Book.fromJson).toList();
  }

  Future<SwipeResult> swipe(String bookId, {required bool right}) async {
    final res = await _dio.post('/api/books/$bookId/swipe', data: {'direction': right ? 'right' : 'left'});
    return SwipeResult(added: (res.data as Map)['added'] == true);
  }

  Future<void> undoSwipe(String bookId, {required bool right}) =>
      _dio.delete('/api/books/$bookId/swipe', queryParameters: {'direction': right ? 'right' : 'left'});

  // ---- Community ----
  Future<List<Activity>> activities() async {
    final res = await _dio.get('/api/activities');
    return _maps(res.data).map(Activity.fromJson).toList();
  }

  // ---- Clubs ----
  Future<List<BookClub>> clubs() async {
    final res = await _dio.get('/api/clubs');
    return _maps(res.data).map(BookClub.fromJson).toList();
  }

  Future<BookClub> club(String id) async {
    final res = await _dio.get('/api/clubs/$id');
    return BookClub.fromJson(res.data as Map<String, dynamic>);
  }

  Future<BookClub> createClub({required String name, required String description, required String bookId, required int totalChapters}) async {
    final res = await _dio.post('/api/clubs', data: {
      'name': name,
      'description': description,
      'bookId': bookId,
      'totalChapters': totalChapters,
    });
    return BookClub.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> joinClub(String id) => _dio.post('/api/clubs/$id/join');

  Future<void> deleteClub(String id) => _dio.delete('/api/clubs/$id');

  Future<void> setChapter(String clubId, int chapterIndex, {required bool read}) =>
      _dio.put('/api/clubs/$clubId/progress', data: {'chapterIndex': chapterIndex, 'action': read ? 'add' : 'remove'});

  Future<ClubMessage> sendClubMessage(String clubId, String text, {bool spoiler = false}) async {
    final res = await _dio.post('/api/clubs/$clubId/messages', data: {'text': text, 'isSpoiler': spoiler});
    return ClubMessage.fromJson(res.data as Map<String, dynamic>);
  }

  // ---- Reading log & challenge ----
  static String today() {
    final now = DateTime.now();
    return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  Future<ReadingActivity> readingActivity() async {
    final res = await _dio.get('/api/reading/activity', queryParameters: {'today': today()});
    return ReadingActivity.fromJson(res.data as Map<String, dynamic>);
  }

  Future<ReadingActivity> logReadingToday() async {
    final res = await _dio.post('/api/reading/log', data: {'date': today()});
    return ReadingActivity.fromJson(res.data as Map<String, dynamic>);
  }

  Future<ReadingChallenge> challenge(int year) async {
    final res = await _dio.get('/api/reading/challenge', queryParameters: {'year': year});
    return ReadingChallenge.fromJson(res.data as Map<String, dynamic>);
  }

  Future<ReadingChallenge> setChallengeTarget(int year, int target) async {
    final res = await _dio.post('/api/reading/challenge', data: {'year': year, 'target': target});
    return ReadingChallenge.fromJson(res.data as Map<String, dynamic>);
  }
}

final apiProvider = Provider<ReaderApi>((ref) => ReaderApi(ref.watch(dioProvider)));
