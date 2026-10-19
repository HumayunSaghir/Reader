import 'package:flutter_test/flutter_test.dart';
import 'package:reader_mobile/core/api_client.dart';
import 'package:reader_mobile/core/config.dart';
import 'package:reader_mobile/models/models.dart';
import 'package:reader_mobile/widgets/common.dart';

void main() {
  group('coverUrl', () {
    test('routes Open Library covers through the API cache', () {
      expect(
        coverUrl('https://covers.openlibrary.org/b/id/12539702-L.jpg', 'M'),
        '$apiBaseUrl/api/covers/12539702-M.jpg',
      );
    });

    test('leaves other URLs alone and handles missing covers', () {
      expect(coverUrl('https://books.google.com/x.jpg'), 'https://books.google.com/x.jpg');
      expect(coverUrl(null), isNull);
      expect(coverUrl(''), isNull);
    });
  });

  group('models', () {
    test('Book parses partial API payloads', () {
      final book = Book.fromJson({'_id': 'b1', 'title': 'Dune', 'author': 'Frank Herbert', 'genres': ['Sci-fi', 3]});
      expect(book.title, 'Dune');
      expect(book.genres, ['Sci-fi']);
      expect(book.ratingsCount, 0);
      expect(book.publishedYear, isNull);
    });

    test('Review handles populated and unpopulated likes', () {
      final review = Review.fromJson({
        '_id': 'r1',
        'user': {'_id': 'u1', 'name': 'Ann'},
        'rating': 4,
        'likes': ['u2', {'_id': 'u3', 'name': 'Bo'}],
        'replies': [],
      });
      expect(review.likes, ['u2', 'u3']);
      expect(review.user.name, 'Ann');
    });

    test('ShelfStatus maps API values', () {
      expect(ShelfStatus.fromApi('currently-reading'), ShelfStatus.reading);
      expect(ShelfStatus.fromApi('nope'), isNull);
    });

    test('BookClub generates chapter names when none are stored', () {
      final club = BookClub.fromJson({'_id': 'c1', 'name': 'Club', 'totalChapters': 3});
      expect(club.chapterNames, ['Chapter 1', 'Chapter 2', 'Chapter 3']);
    });
  });

  test('cleanDescription strips simple HTML', () {
    expect(cleanDescription('<p>One</p><p>Two<br>Three</p>'), 'One\n\nTwo\nThree');
  });
}
