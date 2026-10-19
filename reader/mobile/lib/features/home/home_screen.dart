import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show ScrollCacheExtent;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../data/reader_api.dart';
import '../../models/models.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

const _genres = ['Trending', 'Fiction', 'Fantasy', 'Science Fiction', 'Mystery', 'Thriller', 'Romance', 'History', 'Biography', 'Science', 'Self-help', 'Technology'];
const _pageSize = 40;

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final _scroll = ScrollController();
  bool _showFeed = false;
  String _genre = 'Trending';
  final List<Book> _books = [];
  int _page = 0;
  bool _hasMore = true;
  bool _loading = false;
  Object? _error;
  int _request = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _load(reset: true);
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_showFeed && _scroll.position.extentAfter < 600) _load();
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading && !reset) return;
    if (!reset && !_hasMore) return;
    final myRequest = ++_request;
    final nextPage = reset ? 1 : _page + 1;
    setState(() {
      _loading = true;
      _error = null;
      if (reset) {
        _books.clear();
        _hasMore = true;
      }
    });
    try {
      final books = await ref.read(apiProvider).browse(category: _genre == 'Trending' ? null : _genre, page: nextPage);
      if (myRequest != _request || !mounted) return;
      final seen = _books.map((b) => b.id).toSet();
      setState(() {
        _books.addAll(books.where((b) => seen.add(b.id)));
        _page = nextPage;
        _hasMore = books.length >= _pageSize;
      });
    } catch (e) {
      if (myRequest == _request && mounted) setState(() => _error = e);
    } finally {
      if (myRequest == _request && mounted) setState(() => _loading = false);
    }
  }

  void _selectGenre(String genre) {
    if (genre == _genre) return;
    setState(() => _genre = genre);
    _load(reset: true);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final themeMode = ref.watch(themeModeProvider);
    final isDark = themeMode == ThemeMode.dark || (themeMode == ThemeMode.system && MediaQuery.platformBrightnessOf(context) == Brightness.dark);

    return Scaffold(
      appBar: AppBar(
        title: Text('READER', style: context.text.titleLarge?.copyWith(letterSpacing: 3)),
        actions: [
          IconButton(
            tooltip: isDark ? 'Light mode' : 'Dark mode',
            icon: Icon(isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
            onPressed: () => ref.read(themeModeProvider.notifier).set(isDark ? ThemeMode.light : ThemeMode.dark),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          if (_showFeed) {
            ref.invalidate(activitiesProvider);
            await ref.read(activitiesProvider.future);
          } else {
            await _load(reset: true);
          }
        },
        child: CustomScrollView(
          controller: _scroll,
          physics: const AlwaysScrollableScrollPhysics(),
          // Build and start loading covers a screen ahead, so they're ready when scrolled to
          scrollCacheExtent: const ScrollCacheExtent.pixels(900),
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              sliver: SliverList.list(children: [
                Text('Find your next favorite book.', style: context.text.headlineMedium),
                const SizedBox(height: 6),
                Text('Track what you read and discover books by the tropes you love.', style: TextStyle(color: c.muted)),
                const SizedBox(height: 16),
                _SearchLauncher(onTap: () => context.push('/search')),
                const SizedBox(height: 12),
                Row(children: [
                  _QuickLink(icon: Icons.style_outlined, label: 'Swipe to discover', onTap: () => context.go('/discover')),
                  const SizedBox(width: 10),
                  _QuickLink(icon: Icons.tag, label: 'Browse by trope', onTap: () => context.push('/tags')),
                ]),
                const SizedBox(height: 20),
                SegmentedButton<bool>(
                  segments: const [
                    ButtonSegment(value: false, label: Text('Popular books')),
                    ButtonSegment(value: true, label: Text('Community')),
                  ],
                  selected: {_showFeed},
                  showSelectedIcon: false,
                  onSelectionChanged: (s) => setState(() => _showFeed = s.first),
                ),
                const SizedBox(height: 14),
              ]),
            ),
            if (_showFeed) ...const [_ActivityFeedSliver()] else ...[
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 40,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    scrollDirection: Axis.horizontal,
                    itemCount: _genres.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 8),
                    itemBuilder: (_, i) => ChoiceChip(
                      label: Text(_genres[i]),
                      selected: _genre == _genres[i],
                      onSelected: (_) => _selectGenre(_genres[i]),
                    ),
                  ),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 16)),
              if (_books.isEmpty && _loading)
                const SliverPadding(padding: EdgeInsets.symmetric(horizontal: 16), sliver: BookGridSkeleton(count: 12))
              else if (_books.isEmpty && _error != null)
                SliverFillRemaining(hasScrollBody: false, child: ErrorView(error: _error!, onRetry: () => _load(reset: true), title: "Couldn't load books"))
              else if (_books.isEmpty)
                const SliverFillRemaining(hasScrollBody: false, child: EmptyState(title: 'No books found in this genre'))
              else ...[
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverGrid.builder(
                    gridDelegate: bookGridDelegate,
                    itemCount: _books.length,
                    itemBuilder: (_, i) => BookCard(book: _books[i]),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: Center(
                      child: _loading
                          ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.5))
                          : _error != null
                              ? TextButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('Retry'))
                              : !_hasMore
                                  ? Text("You've reached the end", style: TextStyle(color: c.muted))
                                  : const SizedBox.shrink(),
                    ),
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _SearchLauncher extends StatelessWidget {
  const _SearchLauncher({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      button: true,
      label: 'Search books',
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: c.border),
          ),
          child: Row(children: [
            Icon(Icons.search_rounded, color: c.muted),
            const SizedBox(width: 10),
            Text('Search by title, author or ISBN', style: TextStyle(color: c.muted)),
          ]),
        ),
      ),
    );
  }
}

class _QuickLink extends StatelessWidget {
  const _QuickLink({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: OutlinedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: 18),
        label: Text(label, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
        style: OutlinedButton.styleFrom(minimumSize: const Size(0, 42), padding: const EdgeInsets.symmetric(horizontal: 10)),
      ),
    );
  }
}

class _ActivityFeedSliver extends ConsumerWidget {
  const _ActivityFeedSliver();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(currentUserProvider) == null) {
      return const SliverFillRemaining(
        hasScrollBody: false,
        child: SignInPrompt(icon: Icons.forum_outlined, message: 'See what other readers are shelving and reviewing.'),
      );
    }
    final feed = ref.watch(activitiesProvider);
    return feed.when(
      loading: () => SliverList.builder(
        itemCount: 5,
        itemBuilder: (_, _) => const Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Skeleton(height: 84, radius: 12),
        ),
      ),
      error: (e, _) => SliverFillRemaining(hasScrollBody: false, child: ErrorView(error: e, onRetry: () => ref.invalidate(activitiesProvider))),
      data: (items) => items.isEmpty
          ? const SliverFillRemaining(hasScrollBody: false, child: EmptyState(title: 'No activity yet', message: 'Shelve or review a book to get things started.'))
          : SliverList.separated(
              itemCount: items.length,
              separatorBuilder: (_, _) => const Divider(indent: 16, endIndent: 16),
              itemBuilder: (_, i) => _ActivityTile(activity: items[i]),
            ),
    );
  }
}

class _ActivityTile extends StatelessWidget {
  const _ActivityTile({required this.activity});
  final Activity activity;

  String get _action => switch (activity.type) {
        'review' => 'rated ${activity.rating ?? 0} stars',
        'shelf_status' => 'added to ${activity.status?.label ?? 'a shelf'}',
        'shelf_custom' => 'added to "${activity.customShelf}"',
        _ => 'updated',
      };

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final user = activity.user;
    final book = activity.book;
    return InkWell(
      onTap: book == null ? null : () => context.push('/books/${book.id}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            UserAvatar(name: user?.name ?? '?', avatar: user?.avatar),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text.rich(TextSpan(children: [
                    TextSpan(text: user?.name ?? 'Someone', style: const TextStyle(fontWeight: FontWeight.w700)),
                    TextSpan(text: ' $_action'),
                  ])),
                  if (book != null) Text(book.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: c.muted)),
                  if (activity.type == 'review' && (activity.reviewText ?? '').isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text('"${activity.reviewText}"', maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontStyle: FontStyle.italic)),
                  ],
                  const SizedBox(height: 4),
                  Text(timeAgo(activity.createdAt), style: TextStyle(color: c.muted, fontSize: 12)),
                ],
              ),
            ),
            if (book != null) ...[
              const SizedBox(width: 12),
              CoverImage(url: book.coverImage, size: 'S', width: 40, height: 60, radius: 4),
            ],
          ],
        ),
      ),
    );
  }
}
