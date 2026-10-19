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

/// Micro-trope tags on a book: vote on existing ones or add new ones.
class BookTagsSection extends ConsumerWidget {
  const BookTagsSection({super.key, required this.bookId});
  final String bookId;

  Future<void> _toggle(BuildContext context, WidgetRef ref, TagCount tag) async {
    if (ref.read(currentUserProvider) == null) {
      showSnack(context, 'Log in to tag books.');
      return;
    }
    try {
      final api = ref.read(apiProvider);
      if (tag.mine) {
        await api.removeTag(bookId, tag.tag);
      } else {
        await api.addTag(bookId, tag.tag);
      }
      ref.invalidate(bookTagsProvider(bookId));
    } catch (e) {
      if (context.mounted) showSnack(context, errorMessage(e, 'Could not update the tag.'));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final tags = ref.watch(bookTagsProvider(bookId));
    final signedIn = ref.watch(currentUserProvider) != null;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: c.border)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.tag, size: 18),
            const SizedBox(width: 6),
            Text('Micro-tropes', style: context.text.titleMedium),
            const Spacer(),
            TextButton(onPressed: () => context.push('/tags'), child: const Text('Browse all')),
          ]),
          const SizedBox(height: 6),
          tags.when(
            loading: () => const Skeleton(height: 30, width: 220, radius: 99),
            error: (_, _) => Text("Couldn't load tags.", style: TextStyle(color: c.muted)),
            data: (list) => list.isEmpty
                ? Text('No tropes yet. Is it a slow burn? Found family? Tag it!', style: TextStyle(color: c.muted, fontSize: 13))
                : Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: list.map((t) => _TagChip(
                          tag: t,
                          onOpen: () => context.push('/tags?tags=${Uri.encodeComponent(t.tag)}'),
                          onVote: () => _toggle(context, ref, t),
                        )).toList(),
                  ),
          ),
          if (signedIn) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => _showAddTag(context, ref),
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Add a trope'),
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 40), backgroundColor: c.background),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _showAddTag(BuildContext context, WidgetRef ref) async {
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AddTagSheet(bookId: bookId),
    );
    if (added == true) ref.invalidate(bookTagsProvider(bookId));
  }
}

class _TagChip extends StatelessWidget {
  const _TagChip({required this.tag, required this.onOpen, required this.onVote});
  final TagCount tag;
  final VoidCallback onOpen;
  final VoidCallback onVote;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      decoration: BoxDecoration(
        color: c.background,
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: tag.mine ? c.text : c.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        InkWell(
          onTap: onOpen,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 7, 8, 7),
            child: Text('#${tag.tag}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          ),
        ),
        Semantics(
          button: true,
          label: tag.mine ? 'Remove your vote for ${tag.tag}' : 'Vote for ${tag.tag}',
          child: InkWell(
            onTap: onVote,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
              color: tag.mine ? c.accent : c.surface,
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(tag.mine ? Icons.check : Icons.add, size: 13),
                const SizedBox(width: 2),
                Text('${tag.count}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}

class _AddTagSheet extends ConsumerStatefulWidget {
  const _AddTagSheet({required this.bookId});
  final String bookId;

  @override
  ConsumerState<_AddTagSheet> createState() => _AddTagSheetState();
}

class _AddTagSheetState extends ConsumerState<_AddTagSheet> {
  final _controller = TextEditingController();
  Timer? _debounce;
  List<TagCount> _suggestions = [];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _fetch('');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _fetch(String q) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 200), () async {
      try {
        final list = await ref.read(apiProvider).popularTags(query: q.trim(), limit: 8);
        if (mounted) setState(() => _suggestions = list);
      } catch (_) {}
    });
  }

  Future<void> _add(String tag) async {
    if (tag.trim().isEmpty || _saving) return;
    setState(() => _saving = true);
    try {
      await ref.read(apiProvider).addTag(widget.bookId, tag.trim());
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        showSnack(context, errorMessage(e, 'Could not add the tag.'));
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.viewInsetsOf(context).bottom + 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Add a trope', style: context.text.titleLarge),
          const SizedBox(height: 12),
          TextField(
            controller: _controller,
            autofocus: true,
            maxLength: 40,
            textInputAction: TextInputAction.done,
            onChanged: _fetch,
            onSubmitted: _add,
            decoration: InputDecoration(
              hintText: 'e.g. unreliable narrator',
              counterText: '',
              suffixIcon: IconButton(icon: const Icon(Icons.send_rounded), onPressed: _saving ? null : () => _add(_controller.text)),
            ),
          ),
          const SizedBox(height: 8),
          for (final s in _suggestions)
            ListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              title: Text('#${s.tag}', style: const TextStyle(fontWeight: FontWeight.w600)),
              trailing: Text('${s.count} ${s.count == 1 ? 'book' : 'books'}', style: TextStyle(color: c.muted)),
              onTap: () => _add(s.tag),
            ),
        ],
      ),
    );
  }
}
