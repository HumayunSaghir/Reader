import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../data/reader_api.dart';
import '../../models/models.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

const _pageSize = 24;

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key, this.initialQuery = ''});
  final String initialQuery;

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  late final TextEditingController _controller = TextEditingController(text: widget.initialQuery);
  final _scroll = ScrollController();
  Timer? _debounce;
  CancelToken? _liveCancel;

  // Typeahead
  List<Book> _suggestions = [];
  bool _suggesting = false;

  // Submitted search
  String? _submitted;
  final List<Book> _results = [];
  int _page = 0;
  bool _hasMore = false;
  bool _loading = false;
  Object? _error;
  int _request = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_submitted != null && _scroll.position.extentAfter < 500) _loadMore();
    });
    // Search needs an account; signed-out users see a sign-in prompt instead
    if (widget.initialQuery.isNotEmpty && ref.read(currentUserProvider) != null) _submit(widget.initialQuery);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _liveCancel?.cancel();
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    final q = value.trim();
    if (_submitted != null && q != _submitted) setState(() => _submitted = null);
    if (q.length < 3) {
      _liveCancel?.cancel();
      setState(() {
        _suggestions = [];
        _suggesting = false;
      });
      return;
    }
    setState(() => _suggesting = true);
    _debounce = Timer(const Duration(milliseconds: 250), () async {
      _liveCancel?.cancel();
      final token = _liveCancel = CancelToken();
      try {
        final results = await ref.read(apiProvider).liveSearch(q, cancelToken: token);
        if (mounted && !token.isCancelled) setState(() => _suggestions = results);
      } catch (_) {
        // Typeahead is best effort; the full search still works
      } finally {
        if (mounted && !token.isCancelled) setState(() => _suggesting = false);
      }
    });
  }

  Future<void> _submit(String value) async {
    final q = value.trim();
    if (q.isEmpty) return;
    FocusScope.of(context).unfocus();
    _debounce?.cancel();
    _liveCancel?.cancel();
    setState(() {
      _submitted = q;
      _results.clear();
      _page = 0;
      _hasMore = true;
      _suggestions = [];
      _suggesting = false;
    });
    await _loadMore();
  }

  Future<void> _loadMore() async {
    final q = _submitted;
    if (q == null || _loading || !_hasMore) return;
    final myRequest = ++_request;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final books = await ref.read(apiProvider).search(q, page: _page + 1);
      if (!mounted || myRequest != _request) return;
      final seen = _results.map((b) => b.id).toSet();
      setState(() {
        _results.addAll(books.where((b) => seen.add(b.id)));
        _page++;
        _hasMore = books.length >= _pageSize;
      });
    } catch (e) {
      if (mounted && myRequest == _request) setState(() => _error = e);
    } finally {
      if (mounted && myRequest == _request) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    if (ref.watch(currentUserProvider) == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Search')),
        body: const SignInPrompt(icon: Icons.search_rounded, message: 'Sign in to search for books by title, author or ISBN.'),
      );
    }
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          controller: _controller,
          autofocus: widget.initialQuery.isEmpty,
          textInputAction: TextInputAction.search,
          onChanged: _onChanged,
          onSubmitted: _submit,
          decoration: InputDecoration(
            hintText: 'Search books or authors',
            filled: false,
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            suffixIcon: _controller.text.isEmpty
                ? null
                : IconButton(
                    tooltip: 'Clear',
                    icon: const Icon(Icons.close),
                    onPressed: () {
                      _controller.clear();
                      _onChanged('');
                      setState(() => _submitted = null);
                    },
                  ),
          ),
        ),
      ),
      body: _submitted == null ? _buildSuggestions(c) : _buildResults(c),
    );
  }

  Widget _buildSuggestions(ReaderColors c) {
    final q = _controller.text.trim();
    if (q.length < 3) {
      return const EmptyState(icon: Icons.search_rounded, title: 'Search the library', message: 'Find books by title, author or ISBN.');
    }
    return ListView(
      children: [
        if (_suggesting && _suggestions.isEmpty) const LinearProgressIndicator(minHeight: 2),
        for (final b in _suggestions)
          ListTile(
            leading: CoverImage(url: b.coverImage, size: 'S', width: 36, height: 54, radius: 4),
            title: Text(
              b.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            subtitle: Text(b.author, maxLines: 1, overflow: TextOverflow.ellipsis),
            onTap: () => context.push('/books/${b.id}'),
          ),
        ListTile(
          leading: const Icon(Icons.search_rounded),
          title: Text('See all results for "$q"', style: const TextStyle(fontWeight: FontWeight.w600)),
          onTap: () => _submit(q),
        ),
      ],
    );
  }

  Widget _buildResults(ReaderColors c) {
    if (_results.isEmpty && _loading) {
      return const CustomScrollView(
        slivers: [SliverPadding(padding: EdgeInsets.all(16), sliver: BookGridSkeleton(count: 12))],
      );
    }
    if (_results.isEmpty && _error != null) {
      return ErrorView(error: _error!, onRetry: _loadMore, title: 'Search is temporarily unavailable');
    }
    if (_results.isEmpty) {
      return EmptyState(
        title: 'No books match "$_submitted"',
        message: 'Check the spelling, try fewer words, or search by author.',
        action: OutlinedButton(onPressed: () => context.push('/tags'), child: const Text('Browse by trope')),
      );
    }
    return CustomScrollView(
      controller: _scroll,
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          sliver: SliverToBoxAdapter(
            child: Text('${_results.length}${_hasMore ? '+' : ''} books for "$_submitted"', style: TextStyle(color: c.muted)),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.all(16),
          sliver: SliverGrid.builder(
            gridDelegate: bookGridDelegate,
            itemCount: _results.length,
            itemBuilder: (_, i) => BookCard(book: _results[i]),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 32),
            child: Center(
              child: _loading
                  ? const CircularProgressIndicator(strokeWidth: 2.5)
                  : _error != null
                  ? TextButton.icon(onPressed: _loadMore, icon: const Icon(Icons.refresh), label: const Text('Retry'))
                  : const SizedBox.shrink(),
            ),
          ),
        ),
      ],
    );
  }
}
