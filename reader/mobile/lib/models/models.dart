// Data models mirroring the Reader API's JSON. Parsing is defensive: optional
// or unpopulated fields fall back to sensible defaults instead of throwing.

String _str(dynamic v, [String fallback = '']) => v is String ? v : (v?.toString() ?? fallback);
int _int(dynamic v, [int fallback = 0]) => v is num ? v.toInt() : int.tryParse('$v') ?? fallback;
double _double(dynamic v, [double fallback = 0]) => v is num ? v.toDouble() : double.tryParse('$v') ?? fallback;
DateTime? _date(dynamic v) => v is String ? DateTime.tryParse(v)?.toLocal() : null;
List<String> _strings(dynamic v) => v is List ? v.whereType<String>().toList() : const [];
List<T> _list<T>(dynamic v, T Function(Map<String, dynamic>) parse) =>
    v is List ? v.whereType<Map<String, dynamic>>().map(parse).toList() : <T>[];

/// The `_id` of a field that may be either an id string or a populated object.
String _idOf(dynamic v) => v is Map ? _str(v['_id']) : _str(v);

class AppUser {
  AppUser({required this.id, required this.name, required this.email, this.avatar, this.customShelves = const [], this.token});

  final String id;
  final String name;
  final String email;
  final String? avatar;
  final List<String> customShelves;
  final String? token;

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: _str(json['_id']),
        name: _str(json['name'], 'Reader'),
        email: _str(json['email']),
        avatar: (json['avatar'] as String?)?.isNotEmpty == true ? json['avatar'] as String : null,
        customShelves: _strings(json['customShelves']),
        token: json['token'] as String?,
      );

  AppUser copyWith({String? name, String? avatar, List<String>? customShelves}) => AppUser(
        id: id,
        name: name ?? this.name,
        email: email,
        avatar: avatar ?? this.avatar,
        customShelves: customShelves ?? this.customShelves,
        token: token,
      );

  String get initial => name.isNotEmpty ? name[0].toUpperCase() : '?';
  String get firstName => name.split(' ').first;
}

/// A short user reference (author of a review, club member...).
class UserRef {
  UserRef({required this.id, required this.name, this.avatar});
  final String id;
  final String name;
  final String? avatar;

  factory UserRef.fromJson(dynamic json) {
    if (json is! Map) return UserRef(id: _str(json), name: 'Reader');
    final avatar = json['avatar'];
    return UserRef(
      id: _str(json['_id']),
      name: _str(json['name'], 'Reader'),
      avatar: avatar is String && avatar.isNotEmpty ? avatar : null,
    );
  }

  String get initial => name.isNotEmpty ? name[0].toUpperCase() : '?';
}

class Book {
  Book({
    required this.id,
    required this.title,
    required this.author,
    this.coverImage,
    this.description,
    this.genres = const [],
    this.publishedYear,
    this.pageCount,
    this.isbn,
    this.averageRating = 0,
    this.ratingsCount = 0,
    this.topTags = const [],
  });

  final String id;
  final String title;
  final String author;
  final String? coverImage;
  final String? description;
  final List<String> genres;
  final int? publishedYear;
  final int? pageCount;
  final String? isbn;
  final double averageRating;
  final int ratingsCount;
  final List<String> topTags;

  factory Book.fromJson(Map<String, dynamic> json) => Book(
        id: _str(json['_id']),
        title: _str(json['title'], 'Untitled'),
        author: _str(json['author'], 'Unknown author'),
        coverImage: json['coverImage'] as String?,
        description: json['description'] as String?,
        genres: _strings(json['genres']),
        publishedYear: json['publishedYear'] == null ? null : _int(json['publishedYear']),
        pageCount: json['pageCount'] == null ? null : _int(json['pageCount']),
        isbn: json['isbn'] as String?,
        averageRating: _double(json['averageRating']),
        ratingsCount: _int(json['ratingsCount']),
        topTags: _strings(json['topTags']),
      );

  Book copyWith({String? description, double? averageRating, int? ratingsCount}) => Book(
        id: id,
        title: title,
        author: author,
        coverImage: coverImage,
        description: description ?? this.description,
        genres: genres,
        publishedYear: publishedYear,
        pageCount: pageCount,
        isbn: isbn,
        averageRating: averageRating ?? this.averageRating,
        ratingsCount: ratingsCount ?? this.ratingsCount,
        topTags: topTags,
      );
}

enum ShelfStatus {
  wantToRead('want-to-read', 'Want to read'),
  reading('currently-reading', 'Reading'),
  read('read', 'Read');

  const ShelfStatus(this.apiValue, this.label);
  final String apiValue;
  final String label;

  static ShelfStatus? fromApi(dynamic value) {
    for (final s in ShelfStatus.values) {
      if (s.apiValue == value) return s;
    }
    return null;
  }
}

/// The current user's relationship with one book.
class ShelfEntry {
  ShelfEntry({this.book, this.status, this.customShelves = const [], this.readAt});
  final Book? book;
  final ShelfStatus? status;
  final List<String> customShelves;
  final DateTime? readAt;

  factory ShelfEntry.fromJson(Map<String, dynamic> json) => ShelfEntry(
        book: json['book'] is Map<String, dynamic> ? Book.fromJson(json['book'] as Map<String, dynamic>) : null,
        status: ShelfStatus.fromApi(json['status']),
        customShelves: _strings(json['customShelves']),
        readAt: _date(json['readAt']),
      );
}

class Reply {
  Reply({required this.id, required this.user, required this.text, this.likes = const [], this.parentReplyId, this.createdAt});
  final String id;
  final UserRef user;
  final String text;
  final List<String> likes;
  final String? parentReplyId;
  final DateTime? createdAt;

  factory Reply.fromJson(Map<String, dynamic> json) => Reply(
        id: _str(json['_id']),
        user: UserRef.fromJson(json['user']),
        text: _str(json['text']),
        likes: (json['likes'] as List? ?? const []).map(_idOf).toList(),
        parentReplyId: json['parentReplyId'] as String?,
        createdAt: _date(json['createdAt']),
      );
}

class Review {
  Review({
    required this.id,
    required this.user,
    required this.rating,
    this.text = '',
    this.likes = const [],
    this.replies = const [],
    this.createdAt,
  });

  final String id;
  final UserRef user;
  final int rating;
  final String text;
  final List<String> likes;
  final List<Reply> replies;
  final DateTime? createdAt;

  factory Review.fromJson(Map<String, dynamic> json) => Review(
        id: _str(json['_id']),
        user: UserRef.fromJson(json['user']),
        rating: _int(json['rating']),
        text: _str(json['reviewText']),
        likes: (json['likes'] as List? ?? const []).map(_idOf).toList(),
        replies: _list(json['replies'], Reply.fromJson),
        createdAt: _date(json['createdAt']),
      );
}

class TagCount {
  TagCount({required this.tag, required this.count, this.mine = false});
  final String tag;
  final int count;
  final bool mine;

  factory TagCount.fromJson(Map<String, dynamic> json) => TagCount(
        tag: _str(json['tag']),
        count: _int(json['count'] ?? json['bookCount']),
        mine: json['mine'] == true,
      );
}

class Activity {
  Activity({required this.id, required this.type, this.user, this.book, this.rating, this.reviewText, this.status, this.customShelf, this.createdAt});
  final String id;
  final String type;
  final UserRef? user;
  final Book? book;
  final int? rating;
  final String? reviewText;
  final ShelfStatus? status;
  final String? customShelf;
  final DateTime? createdAt;

  factory Activity.fromJson(Map<String, dynamic> json) => Activity(
        id: _str(json['_id']),
        type: _str(json['type']),
        user: json['user'] == null ? null : UserRef.fromJson(json['user']),
        book: json['book'] is Map<String, dynamic> ? Book.fromJson(json['book'] as Map<String, dynamic>) : null,
        rating: json['rating'] == null ? null : _int(json['rating']),
        reviewText: json['reviewText'] as String?,
        status: ShelfStatus.fromApi(json['status']),
        customShelf: json['customShelf'] as String?,
        createdAt: _date(json['createdAt']),
      );
}

class ClubMember {
  ClubMember({required this.user, this.progress = 0, this.readChapters = const []});
  final UserRef user;
  final int progress;
  final List<int> readChapters;

  factory ClubMember.fromJson(Map<String, dynamic> json) => ClubMember(
        user: UserRef.fromJson(json['user']),
        progress: _int(json['progress']),
        readChapters: (json['readChapters'] as List? ?? const []).map((e) => _int(e)).toList(),
      );
}

class ClubMessage {
  ClubMessage({required this.id, required this.user, required this.text, this.isSpoiler = false, this.createdAt});
  final String id;
  final UserRef user;
  final String text;
  final bool isSpoiler;
  final DateTime? createdAt;

  factory ClubMessage.fromJson(Map<String, dynamic> json) => ClubMessage(
        id: _str(json['_id']),
        user: UserRef.fromJson(json['user']),
        text: _str(json['text']),
        isSpoiler: json['isSpoiler'] == true,
        createdAt: _date(json['createdAt']),
      );
}

class BookClub {
  BookClub({
    required this.id,
    required this.name,
    this.description = '',
    this.book,
    this.creator,
    this.totalChapters = 10,
    this.chapters = const [],
    this.members = const [],
    this.messages = const [],
    this.createdAt,
  });

  final String id;
  final String name;
  final String description;
  final Book? book;
  final UserRef? creator;
  final int totalChapters;
  final List<String> chapters;
  final List<ClubMember> members;
  final List<ClubMessage> messages;
  final DateTime? createdAt;

  factory BookClub.fromJson(Map<String, dynamic> json) => BookClub(
        id: _str(json['_id']),
        name: _str(json['name'], 'Book club'),
        description: _str(json['description']),
        book: json['book'] is Map<String, dynamic> ? Book.fromJson(json['book'] as Map<String, dynamic>) : null,
        creator: json['creator'] == null ? null : UserRef.fromJson(json['creator']),
        totalChapters: _int(json['totalChapters'], 10),
        chapters: _strings(json['chapters']),
        members: _list(json['members'], ClubMember.fromJson),
        messages: _list(json['messages'], ClubMessage.fromJson),
        createdAt: _date(json['createdAt']),
      );

  List<String> get chapterNames =>
      chapters.isNotEmpty ? chapters : List.generate(totalChapters, (i) => 'Chapter ${i + 1}');

  ClubMember? memberFor(String? userId) {
    if (userId == null) return null;
    for (final m in members) {
      if (m.user.id == userId) return m;
    }
    return null;
  }
}

class ReadingActivity {
  ReadingActivity({this.activityMap = const {}, this.currentStreak = 0, this.longestStreak = 0, this.totalDaysRead = 0, this.todayLogged = false});
  final Map<String, int> activityMap;
  final int currentStreak;
  final int longestStreak;
  final int totalDaysRead;
  final bool todayLogged;

  factory ReadingActivity.fromJson(Map<String, dynamic> json) => ReadingActivity(
        activityMap: (json['activityMap'] as Map? ?? const {}).map((k, v) => MapEntry('$k', _int(v))),
        currentStreak: _int(json['currentStreak']),
        longestStreak: _int(json['longestStreak']),
        totalDaysRead: _int(json['totalDaysRead']),
        todayLogged: json['todayLogged'] == true,
      );
}

class ReadingChallenge {
  ReadingChallenge({
    required this.year,
    required this.target,
    required this.completedCount,
    required this.percentage,
    this.paceStatus = 'on_track',
    this.paceMessage = '',
    this.readBooks = const [],
    this.wrapped = const {},
  });

  final int year;
  final int target;
  final int completedCount;
  final int percentage;
  final String paceStatus;
  final String paceMessage;
  final List<Book> readBooks;
  final Map<String, dynamic> wrapped;

  factory ReadingChallenge.fromJson(Map<String, dynamic> json) => ReadingChallenge(
        year: _int(json['year'], DateTime.now().year),
        target: _int(json['target'], 20),
        completedCount: _int(json['completedCount']),
        percentage: _int(json['percentage']),
        paceStatus: _str(json['paceStatus'], 'on_track'),
        paceMessage: _str(json['paceMessage']),
        readBooks: _list(json['readBooks'], Book.fromJson),
        wrapped: json['wrapped'] is Map<String, dynamic> ? json['wrapped'] as Map<String, dynamic> : const {},
      );
}

class SwipeResult {
  SwipeResult({required this.added});
  final bool added;
}
