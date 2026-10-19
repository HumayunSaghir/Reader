import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../data/reader_api.dart';
import '../../models/models.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

const _categories = ['All', 'Fiction', 'Fantasy', 'Mystery', 'Romance', 'Thriller', 'Science Fiction', 'History', 'Horror'];
const _refillAt = 5;
const _maxUndo = 20;

class DiscoverScreen extends ConsumerWidget {
  const DiscoverScreen({super.key, this.tags = const []});
  final List<String> tags;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Swipe to discover')),
      body: user == null
          ? const SignInPrompt(message: 'Swipe right to add books to Want to Read, left to skip them.', icon: Icons.style_outlined)
          // Rebuild the deck from scratch when the account or tag filter changes
          : _Deck(key: ValueKey('${user.id}|${tags.join(',')}'), tags: tags),
    );
  }
}

class _HistoryEntry {
  _HistoryEntry(this.book, this.right, this.added);
  final Book book;
  final bool right;
  final bool added;
}

class _Deck extends ConsumerStatefulWidget {
  const _Deck({super.key, required this.tags});
  final List<String> tags;

  @override
  ConsumerState<_Deck> createState() => _DeckState();
}

class _DeckState extends ConsumerState<_Deck> with SingleTickerProviderStateMixin {
  String _category = 'All';
  final List<Book> _deck = [];
  final List<_HistoryEntry> _history = [];
  final Map<String, String> _descriptions = {};
  final Set<String> _hydrating = {};
  bool _loading = true;
  bool _fetchingMore = false;
  bool _exhausted = false;
  int _request = 0;
  int _added = 0;

  Offset _drag = Offset.zero;
  bool _busy = false;
  late final AnimationController _fly = AnimationController(vsync: this, duration: const Duration(milliseconds: 260));
  Animation<Offset>? _flyAnimation;

  @override
  void initState() {
    super.initState();
    _fly.addListener(() => setState(() => _drag = _flyAnimation!.value));
    _load(reset: true);
  }

  @override
  void dispose() {
    _fly.dispose();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    final myRequest = reset ? ++_request : _request;
    setState(() {
      if (reset) {
        _loading = true;
        _deck.clear();
        _exhausted = false;
      } else {
        _fetchingMore = true;
      }
    });
    try {
      final exclude = reset ? <String>[] : _deck.map((b) => b.id).toList();
      final books = await ref.read(apiProvider).discoverQueue(
            category: _category == 'All' ? null : _category,
            tags: widget.tags,
            exclude: exclude,
          );
      if (!mounted || myRequest != _request) return;
      final known = _deck.map((b) => b.id).toSet();
      final fresh = books.where((b) => known.add(b.id)).toList();
      setState(() {
        _deck.addAll(fresh);
        _exhausted = fresh.isEmpty;
      });
      _hydrateTop();
    } catch (e) {
      if (mounted && myRequest == _request) {
        setState(() => _exhausted = true);
        showSnack(context, errorMessage(e, 'Could not load books.'));
      }
    } finally {
      if (mounted && myRequest == _request) {
        setState(() {
          _loading = false;
          _fetchingMore = false;
        });
      }
    }
  }

  void _maybeRefill() {
    if (!_loading && !_fetchingMore && !_exhausted && _deck.length < _refillAt) _load();
  }

  // Most Open Library books arrive without descriptions; fetch them for the next cards
  void _hydrateTop() {
    for (final book in _deck.take(3)) {
      if ((book.description ?? '').trim().isNotEmpty || _hydrating.contains(book.id)) continue;
      _hydrating.add(book.id);
      ref.read(apiProvider).description(book.id).then((d) {
        if (mounted) setState(() => _descriptions[book.id] = d);
      }).catchError((_) {
        if (mounted) setState(() => _descriptions[book.id] = '');
      });
    }
  }

  Future<void> _swipe(bool right) async {
    if (_deck.isEmpty || _busy) return;
    _busy = true;
    final book = _deck.first;
    HapticFeedback.lightImpact();

    final width = MediaQuery.sizeOf(context).width;
    _flyAnimation = Tween<Offset>(begin: _drag, end: Offset((right ? 1 : -1) * width * 1.5, _drag.dy + 60))
        .animate(CurvedAnimation(parent: _fly, curve: Curves.easeIn));
    final request = ref.read(apiProvider).swipe(book.id, right: right);
    await _fly.forward(from: 0);

    try {
      final result = await request;
      if (!mounted) return;
      setState(() {
        _deck.removeAt(0);
        _history.add(_HistoryEntry(book, right, result.added));
        if (_history.length > _maxUndo) _history.removeAt(0);
        if (right && result.added) _added++;
      });
      if (right && !result.added) showSnack(context, 'Already on your shelves.');
      _hydrateTop();
      _maybeRefill();
      if (right) ref.invalidate(shelvesProvider);
    } catch (e) {
      if (mounted) showSnack(context, errorMessage(e, 'Could not save that swipe.'));
    } finally {
      if (mounted) setState(() => _drag = Offset.zero);
      _busy = false;
    }
  }

  Future<void> _undo() async {
    if (_history.isEmpty || _busy) return;
    _busy = true;
    final last = _history.last;
    try {
      // A right swipe on an already-shelved book changed nothing server-side
      if (!last.right || last.added) {
        await ref.read(apiProvider).undoSwipe(last.book.id, right: last.right);
      }
      if (!mounted) return;
      HapticFeedback.selectionClick();
      setState(() {
        _history.removeLast();
        _deck.removeWhere((b) => b.id == last.book.id);
        _deck.insert(0, last.book);
        if (last.right && last.added) _added = math.max(0, _added - 1);
      });
      if (last.right) ref.invalidate(shelvesProvider);
    } catch (e) {
      if (mounted) showSnack(context, errorMessage(e, 'Could not undo.'));
    } finally {
      _busy = false;
    }
  }

  void _onPanEnd(DragEndDetails details) {
    final width = MediaQuery.sizeOf(context).width;
    final velocity = details.velocity.pixelsPerSecond.dx;
    if (_drag.dx.abs() > width * 0.28 || velocity.abs() > 900) {
      _swipe((_drag.dx + velocity * 0.1) > 0);
    } else {
      // Snap back
      _flyAnimation = Tween<Offset>(begin: _drag, end: Offset.zero).animate(CurvedAnimation(parent: _fly, curve: Curves.easeOutBack));
      _fly.forward(from: 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      children: [
        if (widget.tags.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Row(children: [
              const Icon(Icons.tag, size: 18),
              const SizedBox(width: 6),
              Expanded(child: Text(widget.tags.map((t) => '#$t').join('  '), style: const TextStyle(fontWeight: FontWeight.w700))),
              TextButton(onPressed: () => context.go('/discover'), child: const Text('Clear')),
            ]),
          )
        else
          SizedBox(
            height: 44,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemCount: _categories.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (_, i) => ChoiceChip(
                label: Text(_categories[i]),
                selected: _category == _categories[i],
                onSelected: (_) {
                  if (_category == _categories[i]) return;
                  setState(() => _category = _categories[i]);
                  _load(reset: true);
                },
              ),
            ),
          ),
        const SizedBox(height: 8),
        Expanded(child: _buildStage(c)),
        _Controls(
          canUndo: _history.isNotEmpty,
          hasCard: _deck.isNotEmpty,
          onUndo: _undo,
          onSkip: () => _swipe(false),
          onLike: () => _swipe(true),
          onInfo: _deck.isEmpty ? null : () => context.push('/books/${_deck.first.id}'),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Text(
            _added > 0 ? '$_added added to Want to Read this session' : 'Drag the card, or use the buttons',
            style: TextStyle(color: c.muted, fontSize: 12),
          ),
        ),
      ],
    );
  }

  Widget _buildStage(ReaderColors c) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_deck.isEmpty) {
      if (_fetchingMore) return const Center(child: CircularProgressIndicator());
      return EmptyState(
        icon: Icons.done_all_rounded,
        title: "You've reached the end of this stack",
        message: 'Try another genre or trope, or check back later.',
        action: Wrap(spacing: 10, children: [
          FilledButton(onPressed: () => _load(reset: true), child: const Text('Try again')),
          OutlinedButton(onPressed: () => context.push('/tags'), child: const Text('Browse tropes')),
        ]),
      );
    }

    final width = MediaQuery.sizeOf(context).width;
    final progress = (_drag.dx.abs() / (width * 0.28)).clamp(0.0, 1.0);
    final visible = _deck.take(3).toList();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Stack(
        children: [
          for (var depth = visible.length - 1; depth >= 0; depth--)
            Positioned.fill(
              child: depth == 0
                  ? GestureDetector(
                      onPanUpdate: (d) {
                        if (!_busy) setState(() => _drag += d.delta);
                      },
                      onPanEnd: _busy ? null : _onPanEnd,
                      onTap: () => context.push('/books/${visible[0].id}'),
                      child: Transform.translate(
                        offset: _drag,
                        child: Transform.rotate(
                          angle: (_drag.dx / width) * 0.35,
                          child: _SwipeCard(
                            book: visible[0],
                            description: _descriptions[visible[0].id],
                            likeOpacity: (_drag.dx / (width * 0.25)).clamp(0.0, 1.0),
                            skipOpacity: (-_drag.dx / (width * 0.25)).clamp(0.0, 1.0),
                          ),
                        ),
                      ),
                    )
                  : Builder(builder: (_) {
                      // Cards underneath grow towards the front as the top card leaves
                      final effective = math.max(depth - progress, 0.0);
                      return Transform.translate(
                        offset: Offset(0, effective * 14),
                        child: Transform.scale(
                          scale: 1 - effective * 0.05,
                          alignment: Alignment.bottomCenter,
                          child: _SwipeCard(book: visible[depth], description: _descriptions[visible[depth].id]),
                        ),
                      );
                    }),
            ),
        ],
      ),
    );
  }
}

class _SwipeCard extends StatelessWidget {
  const _SwipeCard({required this.book, this.description, this.likeOpacity = 0, this.skipOpacity = 0});
  final Book book;
  final String? description;
  final double likeOpacity;
  final double skipOpacity;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final raw = (book.description ?? '').trim().isNotEmpty ? book.description! : description;
    final text = raw == null ? null : cleanDescription(raw);

    return Container(
      decoration: BoxDecoration(
        color: c.background,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: c.border),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.12), blurRadius: 20, offset: const Offset(0, 8))],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            flex: 11,
            child: Stack(
              fit: StackFit.expand,
              children: [
                ColoredBox(color: c.surface),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  child: Center(
                    child: AspectRatio(
                      aspectRatio: 2 / 3,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(6),
                          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 18, offset: const Offset(0, 8))],
                        ),
                        child: CoverImage(url: book.coverImage, size: 'M'),
                      ),
                    ),
                  ),
                ),
                Positioned(top: 22, left: 18, child: _Stamp(label: 'WANT', color: c.success, angle: -0.26, opacity: likeOpacity)),
                Positioned(top: 22, right: 18, child: _Stamp(label: 'SKIP', color: c.danger, angle: 0.26, opacity: skipOpacity)),
              ],
            ),
          ),
          Expanded(
            flex: 8,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(book.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: context.text.titleLarge),
                  const SizedBox(height: 4),
                  Text([book.author, if (book.publishedYear != null) '${book.publishedYear}'].join(' · '),
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: c.muted, fontWeight: FontWeight.w500)),
                  if (book.topTags.isNotEmpty || book.genres.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Wrap(spacing: 6, runSpacing: 6, children: [
                      ...book.topTags.map((t) => _Pill('#$t', background: c.accent)),
                      ...book.genres.take(2).map((g) => _Pill(g, background: c.surface)),
                    ]),
                  ],
                  const SizedBox(height: 8),
                  Expanded(
                    child: text == null
                        ? const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Skeleton(), SizedBox(height: 6), Skeleton(width: 180)])
                        : Text(text.isEmpty ? 'No description available.' : text,
                            overflow: TextOverflow.fade, style: TextStyle(color: c.muted, height: 1.45, fontSize: 13.5)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.label, {required this.background});
  final String label;
  final Color background;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(6)),
        child: Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
      );
}

class _Stamp extends StatelessWidget {
  const _Stamp({required this.label, required this.color, required this.angle, required this.opacity});
  final String label;
  final Color color;
  final double angle;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    if (opacity <= 0) return const SizedBox.shrink();
    return Opacity(
      opacity: opacity,
      child: Transform.rotate(
        angle: angle,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.85),
            border: Border.all(color: color, width: 3.5),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 26, letterSpacing: 2)),
        ),
      ),
    );
  }
}

class _Controls extends StatelessWidget {
  const _Controls({required this.canUndo, required this.hasCard, required this.onUndo, required this.onSkip, required this.onLike, this.onInfo});
  final bool canUndo;
  final bool hasCard;
  final VoidCallback onUndo;
  final VoidCallback onSkip;
  final VoidCallback onLike;
  final VoidCallback? onInfo;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    Widget circle({required IconData icon, required String label, required VoidCallback? onTap, Color? color, double size = 64}) {
      return Semantics(
        button: true,
        label: label,
        child: Material(
          color: c.background,
          shape: CircleBorder(side: BorderSide(color: c.border)),
          elevation: 3,
          shadowColor: Colors.black26,
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: SizedBox(
              width: size,
              height: size,
              child: Icon(icon, color: onTap == null ? c.border : (color ?? c.muted), size: size * 0.45),
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          circle(icon: Icons.undo_rounded, label: 'Undo last swipe', onTap: canUndo ? onUndo : null, size: 48),
          const SizedBox(width: 18),
          circle(icon: Icons.close_rounded, label: 'Skip', onTap: hasCard ? onSkip : null, color: c.danger),
          const SizedBox(width: 18),
          circle(icon: Icons.favorite_rounded, label: 'Want to read', onTap: hasCard ? onLike : null, color: c.success),
          const SizedBox(width: 18),
          circle(icon: Icons.info_outline_rounded, label: 'Book details', onTap: onInfo, size: 48),
        ],
      ),
    );
  }
}
