import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../data/reader_api.dart';
import '../../models/models.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

class ReviewsSection extends ConsumerStatefulWidget {
  const ReviewsSection({super.key, required this.bookId});
  final String bookId;

  @override
  ConsumerState<ReviewsSection> createState() => _ReviewsSectionState();
}

class _ReviewsSectionState extends ConsumerState<ReviewsSection> {
  String? _summary;
  bool _summarizing = false;

  Future<void> _summarize() async {
    setState(() => _summarizing = true);
    try {
      final s = await ref.read(apiProvider).reviewSummary(widget.bookId);
      if (mounted) setState(() => _summary = s);
    } catch (e) {
      if (mounted) showSnack(context, errorMessage(e, 'Could not summarize reviews.'));
    } finally {
      if (mounted) setState(() => _summarizing = false);
    }
  }

  void _refresh() {
    ref.invalidate(reviewsProvider(widget.bookId));
    ref.invalidate(bookProvider(widget.bookId));
    setState(() => _summary = null);
  }

  Future<void> _openEditor(Review? existing) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ReviewEditor(bookId: widget.bookId, existing: existing),
    );
    if (saved == true) {
      _refresh();
      if (mounted) showSnack(context, existing == null ? 'Review posted' : 'Review updated');
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final user = ref.watch(currentUserProvider);
    final reviews = ref.watch(reviewsProvider(widget.bookId));
    final list = reviews.value ?? const <Review>[];
    final mine = user == null ? null : list.where((r) => r.user.id == user.id).firstOrNull;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Expanded(child: Text('Community reviews', style: context.text.titleLarge)),
          TextButton.icon(
            onPressed: _summarizing || list.isEmpty ? null : _summarize,
            icon: const Icon(Icons.auto_awesome, size: 18),
            label: Text(_summarizing ? 'Summarizing…' : 'Summarize'),
          ),
        ]),
        if (_summary != null)
          Container(
            margin: const EdgeInsets.only(top: 8, bottom: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: c.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border(left: BorderSide(color: c.success, width: 4)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('What readers are saying', style: TextStyle(color: c.success, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              MarkdownText(_summary!, fontSize: 14),
            ]),
          ),
        const SizedBox(height: 8),
        if (user == null)
          OutlinedButton(onPressed: () => context.push('/login'), child: const Text('Log in to rate and review'))
        else
          FilledButton.icon(
            onPressed: () => _openEditor(mine),
            icon: Icon(mine == null ? Icons.rate_review_outlined : Icons.edit_outlined),
            label: Text(mine == null ? 'Rate and review' : 'Edit your review'),
          ),
        const SizedBox(height: 16),
        reviews.when(
          loading: () => const Column(children: [Skeleton(height: 100, radius: 12), SizedBox(height: 12), Skeleton(height: 100, radius: 12)]),
          error: (e, _) => ErrorView(error: e, onRetry: _refresh, title: "Couldn't load reviews"),
          data: (items) => items.isEmpty
              ? Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text('No reviews yet. Be the first to share your thoughts!', style: TextStyle(color: c.muted)),
                )
              : Column(
                  children: items.map((r) => _ReviewTile(bookId: widget.bookId, review: r, onChanged: _refresh)).toList(),
                ),
        ),
      ],
    );
  }
}

class _ReviewTile extends ConsumerWidget {
  const _ReviewTile({required this.bookId, required this.review, required this.onChanged});
  final String bookId;
  final Review review;
  final VoidCallback onChanged;

  Future<void> _like(BuildContext context, WidgetRef ref) async {
    if (ref.read(currentUserProvider) == null) {
      showSnack(context, 'Log in to like reviews.');
      return;
    }
    try {
      await ref.read(apiProvider).toggleReviewLike(bookId, review.id);
      ref.invalidate(reviewsProvider(bookId));
    } catch (e) {
      if (context.mounted) showSnack(context, errorMessage(e));
    }
  }

  Future<void> _delete(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete review?'),
        content: const Text("This can't be undone."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(apiProvider).deleteReview(bookId, review.id);
      onChanged();
    } catch (e) {
      if (context.mounted) showSnack(context, errorMessage(e, 'Could not delete the review.'));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final userId = ref.watch(currentUserProvider)?.id;
    final liked = userId != null && review.likes.contains(userId);
    final isMine = userId == review.user.id;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.fromLTRB(14, 14, 6, 6),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: c.border)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            UserAvatar(name: review.user.name, avatar: review.user.avatar),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(review.user.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                Row(children: [
                  StarRow(rating: review.rating),
                  const SizedBox(width: 8),
                  Text(timeAgo(review.createdAt), style: TextStyle(color: c.muted, fontSize: 12)),
                ]),
              ]),
            ),
            if (isMine)
              IconButton(tooltip: 'Delete review', icon: const Icon(Icons.delete_outline), onPressed: () => _delete(context, ref)),
          ]),
          if (review.text.isNotEmpty) ...[
            const SizedBox(height: 10),
            Padding(padding: const EdgeInsets.only(right: 8), child: Text(review.text, style: const TextStyle(height: 1.5))),
          ],
          Row(children: [
            TextButton.icon(
              onPressed: () => _like(context, ref),
              icon: Icon(liked ? Icons.favorite : Icons.favorite_border, size: 18, color: liked ? c.danger : c.muted),
              label: Text('${review.likes.length}', style: TextStyle(color: c.muted)),
            ),
            TextButton.icon(
              onPressed: () => showModalBottomSheet(
                context: context,
                isScrollControlled: true,
                builder: (_) => _RepliesSheet(bookId: bookId, reviewId: review.id),
              ),
              icon: Icon(Icons.chat_bubble_outline, size: 18, color: c.muted),
              label: Text(review.replies.isEmpty ? 'Reply' : '${review.replies.length} ${review.replies.length == 1 ? 'reply' : 'replies'}',
                  style: TextStyle(color: c.muted)),
            ),
          ]),
        ],
      ),
    );
  }
}

class _ReviewEditor extends ConsumerStatefulWidget {
  const _ReviewEditor({required this.bookId, this.existing});
  final String bookId;
  final Review? existing;

  @override
  ConsumerState<_ReviewEditor> createState() => _ReviewEditorState();
}

class _ReviewEditorState extends ConsumerState<_ReviewEditor> {
  late int _rating = widget.existing?.rating ?? 0;
  late final _text = TextEditingController(text: widget.existing?.text ?? '');
  bool _saving = false;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_rating == 0) {
      showSnack(context, 'Choose a star rating first.');
      return;
    }
    setState(() => _saving = true);
    try {
      await ref.read(apiProvider).saveReview(widget.bookId, _rating, _text.text.trim());
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        showSnack(context, errorMessage(e, 'Could not save your review.'));
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
          Text(widget.existing == null ? 'Rate and review' : 'Your review', style: context.text.titleLarge),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(5, (i) {
              final star = i + 1;
              return IconButton(
                tooltip: '$star star${star > 1 ? 's' : ''}',
                iconSize: 38,
                onPressed: () => setState(() => _rating = star),
                icon: Icon(star <= _rating ? Icons.star_rounded : Icons.star_outline_rounded, color: star <= _rating ? c.star : c.border),
              );
            }),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _text,
            minLines: 4,
            maxLines: 8,
            maxLength: 5000,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(hintText: 'What did you think? (optional)'),
          ),
          const SizedBox(height: 8),
          FilledButton(onPressed: _saving ? null : _save, child: Text(_saving ? 'Saving…' : widget.existing == null ? 'Post review' : 'Update review')),
        ],
      ),
    );
  }
}

class _RepliesSheet extends ConsumerStatefulWidget {
  const _RepliesSheet({required this.bookId, required this.reviewId});
  final String bookId;
  final String reviewId;

  @override
  ConsumerState<_RepliesSheet> createState() => _RepliesSheetState();
}

class _RepliesSheetState extends ConsumerState<_RepliesSheet> {
  final _text = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _text.text.trim();
    if (text.isEmpty) return;
    setState(() => _sending = true);
    try {
      await ref.read(apiProvider).reply(widget.bookId, widget.reviewId, text);
      _text.clear();
      ref.invalidate(reviewsProvider(widget.bookId));
    } catch (e) {
      if (mounted) showSnack(context, errorMessage(e, 'Could not post your reply.'));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _delete(Reply reply) async {
    try {
      await ref.read(apiProvider).deleteReply(widget.bookId, widget.reviewId, reply.id);
      ref.invalidate(reviewsProvider(widget.bookId));
    } catch (e) {
      if (mounted) showSnack(context, errorMessage(e, 'Could not delete the reply.'));
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final user = ref.watch(currentUserProvider);
    final review = ref.watch(reviewsProvider(widget.bookId)).value?.where((r) => r.id == widget.reviewId).firstOrNull;
    final replies = review?.replies ?? const <Reply>[];

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.7,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Align(alignment: Alignment.centerLeft, child: Text('Replies', style: context.text.titleLarge)),
            ),
            Expanded(
              child: replies.isEmpty
                  ? Center(child: Text('No replies yet.', style: TextStyle(color: c.muted)))
                  : ListView.builder(
                      itemCount: replies.length,
                      itemBuilder: (_, i) {
                        final r = replies[i];
                        return ListTile(
                          leading: UserAvatar(name: r.user.name, avatar: r.user.avatar, radius: 16),
                          title: Text(r.user.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                          subtitle: Text(r.text),
                          trailing: user?.id == r.user.id
                              ? IconButton(tooltip: 'Delete reply', icon: const Icon(Icons.delete_outline, size: 20), onPressed: () => _delete(r))
                              : Text(timeAgo(r.createdAt), style: TextStyle(color: c.muted, fontSize: 11)),
                        );
                      },
                    ),
            ),
            if (user != null)
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
                  child: Row(children: [
                    Expanded(
                      child: TextField(
                        controller: _text,
                        maxLength: 1000,
                        textCapitalization: TextCapitalization.sentences,
                        decoration: const InputDecoration(hintText: 'Write a reply…', counterText: ''),
                        onSubmitted: (_) => _send(),
                      ),
                    ),
                    IconButton(tooltip: 'Send', onPressed: _sending ? null : _send, icon: const Icon(Icons.send_rounded)),
                  ]),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
