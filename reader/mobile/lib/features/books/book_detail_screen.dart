import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../data/reader_api.dart';
import '../../models/models.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';
import 'ai_chat_sheet.dart';
import 'book_tags.dart';
import 'reviews_section.dart';

class BookDetailScreen extends ConsumerWidget {
  const BookDetailScreen({super.key, required this.bookId});
  final String bookId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookAsync = ref.watch(bookProvider(bookId));
    return Scaffold(
      appBar: AppBar(),
      floatingActionButton: bookAsync.hasValue
          ? FloatingActionButton.extended(
              onPressed: () => showAiChat(context, bookAsync.value!),
              icon: const Icon(Icons.auto_awesome),
              label: const Text('Ask AI'),
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
            )
          : null,
      body: bookAsync.when(
        loading: () => const _BookSkeleton(),
        error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(bookProvider(bookId)), title: "Couldn't load this book"),
        data: (book) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(bookProvider(bookId));
            ref.invalidate(reviewsProvider(bookId));
            ref.invalidate(myShelfProvider(bookId));
            ref.invalidate(bookTagsProvider(bookId));
            await ref.read(bookProvider(bookId).future);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
            children: [
              _Header(book: book),
              const SizedBox(height: 20),
              _ShelfPicker(bookId: bookId),
              const SizedBox(height: 24),
              _Description(bookId: bookId),
              const SizedBox(height: 24),
              BookTagsSection(bookId: bookId),
              const SizedBox(height: 20),
              _MatchCard(bookId: bookId),
              const SizedBox(height: 32),
              ReviewsSection(bookId: bookId),
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.book});
  final Book book;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.25), blurRadius: 18, offset: const Offset(0, 8))],
          ),
          child: CoverImage(url: book.coverImage, size: 'L', width: 116, height: 174, radius: 8),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(book.title, style: context.text.headlineSmall),
              const SizedBox(height: 6),
              Text('by ${book.author}', style: context.text.titleMedium?.copyWith(color: c.muted, fontWeight: FontWeight.w500)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 12,
                runSpacing: 6,
                children: [
                  _Fact(
                    icon: Icons.star_rounded,
                    color: c.star,
                    text: book.ratingsCount > 0
                        ? '${book.averageRating.toStringAsFixed(1)} · ${book.ratingsCount} ${book.ratingsCount == 1 ? 'rating' : 'ratings'}'
                        : 'No ratings yet',
                  ),
                  if (book.publishedYear != null) _Fact(icon: Icons.calendar_today_outlined, text: '${book.publishedYear}'),
                  if (book.pageCount != null) _Fact(icon: Icons.description_outlined, text: '${book.pageCount} pages'),
                ],
              ),
              if (book.genres.isNotEmpty) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: book.genres.take(3).map((g) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(99), border: Border.all(color: c.border)),
                        child: Text(g, style: TextStyle(fontSize: 11, color: c.muted, fontWeight: FontWeight.w600)),
                      )).toList(),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact({required this.icon, required this.text, this.color});
  final IconData icon;
  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 15, color: color ?? c.muted),
      const SizedBox(width: 4),
      Text(text, style: TextStyle(fontSize: 13, color: color ?? c.muted, fontWeight: color != null ? FontWeight.w600 : FontWeight.w400)),
    ]);
  }
}

class _ShelfPicker extends ConsumerStatefulWidget {
  const _ShelfPicker({required this.bookId});
  final String bookId;

  @override
  ConsumerState<_ShelfPicker> createState() => _ShelfPickerState();
}

class _ShelfPickerState extends ConsumerState<_ShelfPicker> {
  ShelfStatus? _optimistic;
  bool _hasOptimistic = false;
  bool _saving = false;

  Future<void> _setStatus(ShelfEntry? current, ShelfStatus status) async {
    final next = current?.status == status ? null : status;
    setState(() {
      _optimistic = next;
      _hasOptimistic = true;
      _saving = true;
    });
    try {
      final api = ref.read(apiProvider);
      if (next == null && (current?.customShelves.isEmpty ?? true)) {
        await api.removeFromShelves(widget.bookId);
      } else {
        await api.setStatus(widget.bookId, next);
      }
      ref.invalidate(myShelfProvider(widget.bookId));
      ref.invalidate(shelvesProvider);
      if (mounted) showSnack(context, next == null ? 'Removed from your shelves' : 'Added to ${next.label}');
    } catch (e) {
      if (mounted) showSnack(context, errorMessage(e, 'Could not update your shelf.'));
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
          _hasOptimistic = false;
        });
      }
    }
  }

  Future<void> _toggleCustom(ShelfEntry? current, String shelf) async {
    final adding = !(current?.customShelves.contains(shelf) ?? false);
    try {
      await ref.read(apiProvider).setCustomShelf(widget.bookId, shelf, add: adding);
      ref.invalidate(myShelfProvider(widget.bookId));
      ref.invalidate(shelvesProvider);
      if (mounted) showSnack(context, adding ? 'Added to $shelf' : 'Removed from $shelf');
    } catch (e) {
      if (mounted) showSnack(context, errorMessage(e, 'Could not update the shelf.'));
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final c = context.colors;
    if (user == null) {
      return OutlinedButton.icon(
        onPressed: () => context.push('/login'),
        icon: const Icon(Icons.bookmark_add_outlined),
        label: const Text('Log in to track this book'),
      );
    }
    final shelf = ref.watch(myShelfProvider(widget.bookId)).value;
    final status = _hasOptimistic ? _optimistic : shelf?.status;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SegmentedButton<ShelfStatus>(
          segments: ShelfStatus.values.map((s) => ButtonSegment(value: s, label: Text(s.label, maxLines: 1))).toList(),
          selected: status == null ? <ShelfStatus>{} : {status},
          emptySelectionAllowed: true,
          showSelectedIcon: true,
          onSelectionChanged: _saving
              ? null
              : (selection) {
                  // Tapping the active segment clears it
                  final tapped = selection.isEmpty ? status! : selection.first;
                  _setStatus(shelf, tapped);
                },
        ),
        if (user.customShelves.isNotEmpty) ...[
          const SizedBox(height: 14),
          Text('YOUR SHELVES', style: TextStyle(fontSize: 11, letterSpacing: 1, fontWeight: FontWeight.w700, color: c.muted)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: user.customShelves.map((name) {
              final active = shelf?.customShelves.contains(name) ?? false;
              return FilterChip(
                label: Text(name),
                selected: active,
                avatar: Icon(active ? Icons.check : Icons.add, size: 16, color: active ? c.onButton : c.text),
                onSelected: (_) => _toggleCustom(shelf, name),
              );
            }).toList(),
          ),
        ],
      ],
    );
  }
}

class _Description extends ConsumerStatefulWidget {
  const _Description({required this.bookId});
  final String bookId;

  @override
  ConsumerState<_Description> createState() => _DescriptionState();
}

class _DescriptionState extends ConsumerState<_Description> {
  static const _previewChars = 420;
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final async = ref.watch(bookDescriptionProvider(widget.bookId));
    return async.when(
      loading: () => const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Skeleton(), SizedBox(height: 8), Skeleton(), SizedBox(height: 8), Skeleton(width: 200),
      ]),
      error: (_, _) => Text('No description is available for this book yet.', style: TextStyle(color: c.muted)),
      data: (raw) {
        final text = cleanDescription(raw);
        if (text.isEmpty) return Text('No description is available for this book yet.', style: TextStyle(color: c.muted));
        final isLong = text.length > _previewChars;
        final shown = isLong && !_expanded ? '${text.substring(0, _previewChars).replaceFirst(RegExp(r'\s+\S*$'), '')}…' : text;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MarkdownText(shown),
            if (isLong)
              TextButton(
                style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 36)),
                onPressed: () => setState(() => _expanded = !_expanded),
                child: Text(_expanded ? 'Show less' : 'Show more', style: const TextStyle(decoration: TextDecoration.underline)),
              ),
          ],
        );
      },
    );
  }
}

class _MatchCard extends ConsumerStatefulWidget {
  const _MatchCard({required this.bookId});
  final String bookId;

  @override
  ConsumerState<_MatchCard> createState() => _MatchCardState();
}

class _MatchCardState extends ConsumerState<_MatchCard> {
  String? _result;
  bool _loading = false;

  Future<void> _load() async {
    if (ref.read(currentUserProvider) == null) {
      showSnack(context, 'Log in to get a personalized recommendation.');
      return;
    }
    setState(() => _loading = true);
    try {
      final text = await ref.read(apiProvider).recommendation(widget.bookId);
      if (mounted) setState(() => _result = text);
    } catch (e) {
      if (mounted) showSnack(context, errorMessage(e, 'Could not get a recommendation.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: c.border),
        gradient: LinearGradient(colors: [c.surface, c.background]),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.psychology_alt_outlined, color: c.success),
            const SizedBox(width: 8),
            Text('Should I read this?', style: context.text.titleMedium),
          ]),
          const SizedBox(height: 4),
          Text("A personal match score based on the books you've rated 5 stars.", style: TextStyle(color: c.muted, fontSize: 13)),
          const SizedBox(height: 12),
          if (_result != null)
            MarkdownText(_result!, fontSize: 14)
          else
            FilledButton(
              onPressed: _loading ? null : _load,
              child: Text(_loading ? 'Analyzing your reading history…' : 'Get my match score'),
            ),
        ],
      ),
    );
  }
}

class _BookSkeleton extends StatelessWidget {
  const _BookSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Skeleton(width: 116, height: 174, radius: 8),
          SizedBox(width: 16),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Skeleton(height: 24), SizedBox(height: 10), Skeleton(height: 16, width: 140), SizedBox(height: 14), Skeleton(height: 12, width: 180),
          ])),
        ]),
        SizedBox(height: 24),
        Skeleton(height: 44, radius: 10),
        SizedBox(height: 24),
        Skeleton(), SizedBox(height: 8), Skeleton(), SizedBox(height: 8), Skeleton(width: 220),
      ]),
    );
  }
}
