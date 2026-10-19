import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../data/reader_api.dart';
import '../../models/models.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

const _maxTags = 5;

class TagsScreen extends ConsumerStatefulWidget {
  const TagsScreen({super.key, this.initialTags = const []});
  final List<String> initialTags;

  @override
  ConsumerState<TagsScreen> createState() => _TagsScreenState();
}

class _TagsScreenState extends ConsumerState<TagsScreen> {
  late final List<String> _selected = [...widget.initialTags];
  String _query = '';
  Timer? _debounce;
  final _scroll = ScrollController();

  final List<Book> _books = [];
  int _page = 0;
  bool _hasMore = false;
  bool _loading = false;
  Object? _error;
  int _request = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.extentAfter < 500) _loadMore();
    });
    _reload();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _scroll.dispose();
    super.dispose();
  }

  void _reload() {
    _request++;
    setState(() {
      _books.clear();
      _page = 0;
      _hasMore = _selected.isNotEmpty;
      _error = null;
      _loading = false;
    });
    _loadMore();
  }

  Future<void> _loadMore() async {
    if (_selected.isEmpty || _loading || !_hasMore) return;
    final myRequest = _request;
    setState(() => _loading = true);
    try {
      final result = await ref.read(apiProvider).booksWithTags(_selected, page: _page + 1);
      if (!mounted || myRequest != _request) return;
      setState(() {
        _books.addAll(result.books);
        _page++;
        _hasMore = result.hasMore;
      });
    } catch (e) {
      if (mounted && myRequest == _request) setState(() => _error = e);
    } finally {
      if (mounted && myRequest == _request) setState(() => _loading = false);
    }
  }

  void _toggle(String tag) {
    setState(() {
      if (_selected.contains(tag)) {
        _selected.remove(tag);
      } else if (_selected.length < _maxTags) {
        _selected.add(tag);
      }
    });
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final tags = ref.watch(popularTagsProvider(_query));

    return Scaffold(
      appBar: AppBar(title: const Text('Browse by trope')),
      body: CustomScrollView(
        controller: _scroll,
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            sliver: SliverList.list(children: [
              Text('Find books by the tiny things you love.', style: context.text.headlineSmall),
              const SizedBox(height: 4),
              Text('Pick up to $_maxTags tropes to see books tagged with all of them.', style: TextStyle(color: c.muted)),
              const SizedBox(height: 14),
              TextField(
                decoration: const InputDecoration(hintText: 'Search tropes', prefixIcon: Icon(Icons.search)),
                onChanged: (v) {
                  _debounce?.cancel();
                  _debounce = Timer(const Duration(milliseconds: 250), () => setState(() => _query = v.trim()));
                },
              ),
              const SizedBox(height: 12),
              tags.when(
                loading: () => const Skeleton(height: 34, radius: 99),
                error: (e, _) => Text("Couldn't load tropes.", style: TextStyle(color: c.muted)),
                data: (list) {
                  final all = {...list.map((t) => t.tag), ..._selected}.toList();
                  if (all.isEmpty) {
                    return Text(_query.isEmpty ? 'No tropes yet. Open any book and be the first to tag it!' : 'No tropes match that search.',
                        style: TextStyle(color: c.muted));
                  }
                  final counts = {for (final t in list) t.tag: t.count};
                  return Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: all.map((tag) {
                      final selected = _selected.contains(tag);
                      return FilterChip(
                        label: Text(counts[tag] != null ? '#$tag  ${counts[tag]}' : '#$tag'),
                        selected: selected,
                        onSelected: !selected && _selected.length >= _maxTags ? null : (_) => _toggle(tag),
                      );
                    }).toList(),
                  );
                },
              ),
              if (_selected.isNotEmpty) ...[
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () => context.go('/discover?tags=${Uri.encodeComponent(_selected.join(','))}'),
                  icon: const Icon(Icons.style_outlined),
                  label: const Text('Swipe through these'),
                ),
              ],
              const SizedBox(height: 8),
              const Divider(),
            ]),
          ),
          if (_selected.isEmpty)
            const SliverFillRemaining(hasScrollBody: false, child: EmptyState(icon: Icons.tag, title: 'Pick a trope to see matching books'))
          else if (_books.isEmpty && _loading)
            const SliverPadding(padding: EdgeInsets.symmetric(horizontal: 16), sliver: BookGridSkeleton())
          else if (_books.isEmpty && _error != null)
            SliverFillRemaining(hasScrollBody: false, child: ErrorView(error: _error!, onRetry: _reload))
          else if (_books.isEmpty)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: EmptyState(title: 'No books have all of these tropes yet', message: 'Try removing one.'),
            )
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
                child: Center(child: _loading ? const CircularProgressIndicator(strokeWidth: 2.5) : const SizedBox.shrink()),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
