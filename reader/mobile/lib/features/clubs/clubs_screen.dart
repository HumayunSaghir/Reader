import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../data/reader_api.dart';
import '../../models/models.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

class ClubsScreen extends ConsumerWidget {
  const ClubsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clubs = ref.watch(clubsProvider);
    final user = ref.watch(currentUserProvider);

    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Book clubs')),
        body: const SignInPrompt(icon: Icons.groups_outlined, message: 'Join a club to read together, track progress and chat without spoilers.'),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Book clubs')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final created = await showModalBottomSheet<BookClub>(
            context: context,
            isScrollControlled: true,
            useSafeArea: true,
            builder: (_) => const _CreateClubSheet(),
          );
          if (created != null && context.mounted) {
            ref.invalidate(clubsProvider);
            context.push('/clubs/${created.id}');
          }
        },
        icon: const Icon(Icons.add),
        label: const Text('Create club'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(clubsProvider);
          await ref.read(clubsProvider.future);
        },
        child: clubs.when(
          loading: () => ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: 4,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (_, _) => const Skeleton(height: 110, radius: 16),
          ),
          error: (e, _) => ListView(children: [ErrorView(error: e, onRetry: () => ref.invalidate(clubsProvider))]),
          data: (list) => list.isEmpty
              ? ListView(children: const [
                  EmptyState(icon: Icons.groups_outlined, title: 'No book clubs yet', message: 'Start one and read together with friends.'),
                ])
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                  itemCount: list.length + 1,
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                  itemBuilder: (context, i) {
                    if (i == 0) {
                      return Text('Read together, track progress, and chat without spoilers.', style: TextStyle(color: context.colors.muted));
                    }
                    return _ClubCard(club: list[i - 1]);
                  },
                ),
        ),
      ),
    );
  }
}

class _ClubCard extends StatelessWidget {
  const _ClubCard({required this.club});
  final BookClub club;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => context.push('/clubs/${club.id}'),
      child: Ink(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: c.border)),
        child: Row(children: [
          CoverImage(url: club.book?.coverImage, width: 60, height: 90),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(club.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: context.text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
              if (club.book != null)
                Text('Reading ${club.book!.title}', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: c.muted)),
              const SizedBox(height: 8),
              Row(children: [
                Icon(Icons.people_alt_outlined, size: 16, color: c.muted),
                const SizedBox(width: 4),
                Text('${club.members.length} ${club.members.length == 1 ? 'member' : 'members'}', style: TextStyle(color: c.muted, fontSize: 13)),
                const SizedBox(width: 12),
                Icon(Icons.menu_book_outlined, size: 16, color: c.muted),
                const SizedBox(width: 4),
                Text('${club.totalChapters} chapters', style: TextStyle(color: c.muted, fontSize: 13)),
              ]),
            ]),
          ),
          Icon(Icons.chevron_right, color: c.muted),
        ]),
      ),
    );
  }
}

class _CreateClubSheet extends ConsumerStatefulWidget {
  const _CreateClubSheet();

  @override
  ConsumerState<_CreateClubSheet> createState() => _CreateClubSheetState();
}

class _CreateClubSheetState extends ConsumerState<_CreateClubSheet> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _description = TextEditingController();
  final _chapters = TextEditingController(text: '12');
  final _bookQuery = TextEditingController();
  Timer? _debounce;
  List<Book> _results = [];
  Book? _book;
  bool _saving = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _name.dispose();
    _description.dispose();
    _chapters.dispose();
    _bookQuery.dispose();
    super.dispose();
  }

  void _search(String q) {
    _debounce?.cancel();
    if (q.trim().length < 3) {
      setState(() => _results = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      try {
        final books = await ref.read(apiProvider).liveSearch(q.trim());
        if (mounted) setState(() => _results = books);
      } catch (_) {}
    });
  }

  Future<void> _create() async {
    if (!_formKey.currentState!.validate()) return;
    if (_book == null) {
      showSnack(context, 'Choose the book your club will read.');
      return;
    }
    setState(() => _saving = true);
    try {
      final club = await ref.read(apiProvider).createClub(
            name: _name.text.trim(),
            description: _description.text.trim(),
            bookId: _book!.id,
            totalChapters: int.tryParse(_chapters.text) ?? 10,
          );
      if (mounted) Navigator.pop(context, club);
    } catch (e) {
      if (mounted) {
        showSnack(context, errorMessage(e, 'Could not create the club.'));
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Form(
        key: _formKey,
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          children: [
            Text('Start a book club', style: context.text.titleLarge),
            const SizedBox(height: 16),
            TextFormField(
              controller: _name,
              maxLength: 80,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Club name'),
              validator: (v) => (v ?? '').trim().isEmpty ? 'Give your club a name' : null,
            ),
            TextFormField(
              controller: _description,
              maxLength: 1000,
              maxLines: 3,
              minLines: 1,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(labelText: 'Description (optional)'),
            ),
            TextFormField(
              controller: _chapters,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Number of chapters'),
              validator: (v) {
                final n = int.tryParse(v ?? '');
                if (n == null || n < 1 || n > 200) return 'Between 1 and 200';
                return null;
              },
            ),
            const SizedBox(height: 16),
            if (_book != null)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CoverImage(url: _book!.coverImage, size: 'S', width: 36, height: 54, radius: 4),
                title: Text(_book!.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(_book!.author, maxLines: 1, overflow: TextOverflow.ellipsis),
                trailing: TextButton(onPressed: () => setState(() => _book = null), child: const Text('Change')),
              )
            else ...[
              TextField(
                controller: _bookQuery,
                onChanged: _search,
                decoration: const InputDecoration(labelText: 'Book', hintText: 'Search by title or author', prefixIcon: Icon(Icons.search)),
              ),
              for (final b in _results)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CoverImage(url: b.coverImage, size: 'S', width: 32, height: 48, radius: 4),
                  title: Text(b.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text(b.author, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: c.muted)),
                  onTap: () => setState(() {
                    _book = b;
                    _results = [];
                  }),
                ),
            ],
            const SizedBox(height: 20),
            FilledButton(onPressed: _saving ? null : _create, child: Text(_saving ? 'Creating…' : 'Create club')),
          ],
        ),
      ),
    );
  }
}
