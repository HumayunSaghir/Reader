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

class ClubDetailScreen extends ConsumerStatefulWidget {
  const ClubDetailScreen({super.key, required this.clubId});
  final String clubId;

  @override
  ConsumerState<ClubDetailScreen> createState() => _ClubDetailScreenState();
}

class _ClubDetailScreenState extends ConsumerState<ClubDetailScreen> with WidgetsBindingObserver {
  static const _pollInterval = Duration(seconds: 10);

  BookClub? _club;
  Object? _error;
  bool _loading = true;
  Timer? _poll;
  bool _joining = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // Clubs are members-only: load once someone signs in from the prompt below
    ref.listenManual(currentUserProvider.select((u) => u?.id), (_, id) {
      setState(() {
        _club = null;
        _loading = id != null;
      });
      if (id != null) _fetch();
    });
    _fetch();
    _startPolling();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _poll?.cancel();
    super.dispose();
  }

  // Only poll for new messages while the app is in the foreground
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _fetch();
      _startPolling();
    } else {
      _poll?.cancel();
    }
  }

  void _startPolling() {
    _poll?.cancel();
    _poll = Timer.periodic(_pollInterval, (_) => _fetch(silent: true));
  }

  Future<void> _fetch({bool silent = false}) async {
    if (ref.read(currentUserProvider) == null) {
      if (mounted && _loading) setState(() => _loading = false);
      return;
    }
    try {
      final club = await ref.read(apiProvider).club(widget.clubId);
      if (mounted) {
        setState(() {
          _club = club;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted && !silent) setState(() => _error = e);
    } finally {
      if (mounted && _loading) setState(() => _loading = false);
    }
  }

  Future<void> _join() async {
    if (ref.read(currentUserProvider) == null) {
      context.push('/login');
      return;
    }
    setState(() => _joining = true);
    try {
      await ref.read(apiProvider).joinClub(widget.clubId);
      await _fetch();
      ref.invalidate(clubsProvider);
      if (mounted) showSnack(context, 'Welcome to the club!');
    } catch (e) {
      if (mounted) showSnack(context, errorMessage(e, 'Could not join the club.'));
    } finally {
      if (mounted) setState(() => _joining = false);
    }
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete this club?'),
        content: const Text('Members, progress and chat history will be removed for everyone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(apiProvider).deleteClub(widget.clubId);
      ref.invalidate(clubsProvider);
      if (mounted) context.pop();
    } catch (e) {
      if (mounted) showSnack(context, errorMessage(e, 'Could not delete the club.'));
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final club = _club;

    if (user == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const SignInPrompt(icon: Icons.groups_outlined, message: 'Sign in to see this club, its members and the chat.'),
      );
    }

    if (club == null) {
      return Scaffold(
        appBar: AppBar(),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : ErrorView(error: _error ?? 'Club not found', onRetry: _fetch, title: "Couldn't load this club"),
      );
    }

    final me = club.memberFor(user.id);
    final isCreator = club.creator?.id == user.id;

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(club.name, maxLines: 1, overflow: TextOverflow.ellipsis),
          actions: [
            if (isCreator)
              PopupMenuButton<String>(
                onSelected: (_) => _delete(),
                itemBuilder: (_) => const [PopupMenuItem(value: 'delete', child: Text('Delete club'))],
              ),
          ],
          bottom: const TabBar(tabs: [Tab(text: 'Progress'), Tab(text: 'Discussion')]),
        ),
        body: Column(
          children: [
            _ClubHeader(club: club, me: me, joining: _joining, onJoin: _join),
            Expanded(
              child: TabBarView(children: [
                _ProgressTab(club: club, me: me, onChanged: _fetch),
                _ChatTab(club: club, isMember: me != null, onSent: _fetch, onJoin: _join),
              ]),
            ),
          ],
        ),
      ),
    );
  }
}

class _ClubHeader extends StatelessWidget {
  const _ClubHeader({required this.club, required this.me, required this.joining, required this.onJoin});
  final BookClub club;
  final ClubMember? me;
  final bool joining;
  final VoidCallback onJoin;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final book = club.book;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        GestureDetector(
          onTap: book == null ? null : () => context.push('/books/${book.id}'),
          child: CoverImage(url: book?.coverImage, width: 56, height: 84),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (book != null) Text(book.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
            if (book != null) Text(book.author, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: c.muted)),
            const SizedBox(height: 4),
            Text('${club.members.length} ${club.members.length == 1 ? 'member' : 'members'} · by ${club.creator?.name ?? 'someone'}',
                style: TextStyle(color: c.muted, fontSize: 12)),
            const SizedBox(height: 8),
            if (me == null)
              FilledButton(onPressed: joining ? null : onJoin, child: Text(joining ? 'Joining…' : 'Join club'))
            else ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(value: me!.progress / 100, minHeight: 8, color: c.success),
              ),
              const SizedBox(height: 4),
              Text('You: ${me!.progress}% complete', style: TextStyle(fontSize: 12, color: c.muted)),
            ],
          ]),
        ),
      ]),
    );
  }
}

class _ProgressTab extends ConsumerStatefulWidget {
  const _ProgressTab({required this.club, required this.me, required this.onChanged});
  final BookClub club;
  final ClubMember? me;
  final Future<void> Function({bool silent}) onChanged;

  @override
  ConsumerState<_ProgressTab> createState() => _ProgressTabState();
}

class _ProgressTabState extends ConsumerState<_ProgressTab> {
  final Set<int> _pending = {};

  Future<void> _toggle(int index, bool read) async {
    setState(() => _pending.add(index));
    try {
      await ref.read(apiProvider).setChapter(widget.club.id, index, read: read);
      await widget.onChanged(silent: true);
    } catch (e) {
      if (mounted) showSnack(context, errorMessage(e, 'Could not update your progress.'));
    } finally {
      if (mounted) setState(() => _pending.remove(index));
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final members = [...widget.club.members]..sort((a, b) => b.progress.compareTo(a.progress));
    final chapters = widget.club.chapterNames;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        if (widget.club.description.isNotEmpty) ...[
          Text(widget.club.description),
          const SizedBox(height: 16),
        ],
        Text('Members', style: context.text.titleMedium),
        const SizedBox(height: 8),
        for (final m in members)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(children: [
              UserAvatar(name: m.user.name, avatar: m.user.avatar, radius: 16),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(m.user.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: LinearProgressIndicator(value: m.progress / 100, minHeight: 6, color: c.success),
                  ),
                ]),
              ),
              const SizedBox(width: 10),
              Text('${m.progress}%', style: const TextStyle(fontWeight: FontWeight.w700)),
            ]),
          ),
        if (widget.me != null) ...[
          const SizedBox(height: 20),
          Text('Your chapters', style: context.text.titleMedium),
          const SizedBox(height: 4),
          Text('${widget.me!.readChapters.length} of ${chapters.length} read', style: TextStyle(color: c.muted)),
          for (var i = 0; i < chapters.length; i++)
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              title: Text(chapters[i]),
              value: widget.me!.readChapters.contains(i),
              onChanged: _pending.contains(i) ? null : (v) => _toggle(i, v ?? false),
            ),
        ],
      ],
    );
  }
}

class _ChatTab extends ConsumerStatefulWidget {
  const _ChatTab({required this.club, required this.isMember, required this.onSent, required this.onJoin});
  final BookClub club;
  final bool isMember;
  final Future<void> Function({bool silent}) onSent;
  final VoidCallback onJoin;

  @override
  ConsumerState<_ChatTab> createState() => _ChatTabState();
}

class _ChatTabState extends ConsumerState<_ChatTab> {
  final _input = TextEditingController();
  final Set<String> _revealed = {};
  bool _spoiler = false;
  bool _sending = false;

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await ref.read(apiProvider).sendClubMessage(widget.club.id, text, spoiler: _spoiler);
      _input.clear();
      setState(() => _spoiler = false);
      await widget.onSent(silent: true);
    } catch (e) {
      if (mounted) showSnack(context, errorMessage(e, 'Could not send your message.'));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final userId = ref.watch(currentUserProvider)?.id;
    final messages = widget.club.messages.reversed.toList(); // newest at the bottom of a reversed list

    return Column(
      children: [
        Expanded(
          child: messages.isEmpty
              ? const EmptyState(icon: Icons.forum_outlined, title: 'No messages yet', message: 'Start the conversation!')
              : ListView.builder(
                  reverse: true,
                  padding: const EdgeInsets.all(16),
                  itemCount: messages.length,
                  itemBuilder: (_, i) {
                    final m = messages[i];
                    final mine = m.user.id == userId;
                    final hidden = m.isSpoiler && !_revealed.contains(m.id);
                    return Align(
                      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.78),
                        child: Column(
                          crossAxisAlignment: mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                          children: [
                            Text('${mine ? 'You' : m.user.name} · ${timeAgo(m.createdAt)}', style: TextStyle(fontSize: 11, color: c.muted)),
                            const SizedBox(height: 3),
                            GestureDetector(
                              onTap: hidden ? () => setState(() => _revealed.add(m.id)) : null,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                                decoration: BoxDecoration(
                                  color: hidden ? c.text : (mine ? c.accent : c.surface),
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: hidden
                                    ? Row(mainAxisSize: MainAxisSize.min, children: [
                                        Icon(Icons.visibility_off_outlined, size: 16, color: c.background),
                                        const SizedBox(width: 6),
                                        Text('Spoiler · tap to reveal', style: TextStyle(color: c.background, fontWeight: FontWeight.w600)),
                                      ])
                                    : Text(m.text),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
        const Divider(),
        SafeArea(
          top: false,
          child: widget.isMember
              ? Padding(
                  padding: const EdgeInsets.fromLTRB(8, 4, 8, 8),
                  child: Row(children: [
                    IconButton(
                      tooltip: _spoiler ? 'Marked as spoiler' : 'Mark as spoiler',
                      isSelected: _spoiler,
                      icon: const Icon(Icons.visibility_outlined),
                      selectedIcon: Icon(Icons.visibility_off, color: c.danger),
                      onPressed: () => setState(() => _spoiler = !_spoiler),
                    ),
                    Expanded(
                      child: TextField(
                        controller: _input,
                        maxLength: 2000,
                        minLines: 1,
                        maxLines: 4,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: InputDecoration(hintText: _spoiler ? 'Spoiler message…' : 'Message the club…', counterText: ''),
                        onSubmitted: (_) => _send(),
                      ),
                    ),
                    IconButton(tooltip: 'Send', onPressed: _sending ? null : _send, icon: const Icon(Icons.send_rounded)),
                  ]),
                )
              : Padding(
                  padding: const EdgeInsets.all(12),
                  child: OutlinedButton(onPressed: widget.onJoin, child: const Text('Join the club to chat')),
                ),
        ),
      ],
    );
  }
}
