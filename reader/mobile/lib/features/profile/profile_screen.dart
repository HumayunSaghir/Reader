import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../data/reader_api.dart';
import '../../models/models.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final user = auth.value;

    if (auth.isLoading && user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (user == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('My books')),
        body: const SignInPrompt(message: 'Your shelves, reading streak and yearly challenge live here.', icon: Icons.bookmarks_outlined),
      );
    }
    return _SignedInProfile(user: user);
  }
}

class _SignedInProfile extends ConsumerWidget {
  const _SignedInProfile({required this.user});
  final AppUser user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shelfTabs = ['Want to read', 'Reading', 'Read', ...user.customShelves];
    return DefaultTabController(
      key: ValueKey(shelfTabs.join('|')),
      length: shelfTabs.length,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('My books'),
          actions: [
            IconButton(tooltip: 'Settings', icon: const Icon(Icons.settings_outlined), onPressed: () => _showSettings(context, ref)),
          ],
        ),
        body: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(shelvesProvider);
            ref.invalidate(readingActivityProvider);
            ref.invalidate(challengeProvider(DateTime.now().year));
            await ref.read(shelvesProvider.future);
          },
          child: NestedScrollView(
            headerSliverBuilder: (context, _) => [
              SliverToBoxAdapter(child: _ProfileHeader(user: user)),
              const SliverToBoxAdapter(child: _StreakCard()),
              const SliverToBoxAdapter(child: _ChallengeCard()),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 20, 8, 0),
                  child: Row(children: [
                    Expanded(child: Text('Shelves', style: context.text.titleLarge)),
                    TextButton.icon(
                      onPressed: () => _manageShelves(context, ref, user),
                      icon: const Icon(Icons.tune, size: 18),
                      label: const Text('Manage'),
                    ),
                  ]),
                ),
              ),
              SliverPersistentHeader(
                pinned: true,
                delegate: _TabBarDelegate(
                  TabBar(
                    isScrollable: true,
                    tabAlignment: TabAlignment.start,
                    tabs: shelfTabs.map((t) => Tab(text: t)).toList(),
                  ),
                  Theme.of(context).scaffoldBackgroundColor,
                ),
              ),
            ],
            body: TabBarView(
              children: [
                for (final s in ShelfStatus.values) _ShelfGrid(filter: (e) => e.status == s, emptyLabel: s.label),
                for (final name in user.customShelves) _ShelfGrid(filter: (e) => e.customShelves.contains(name), emptyLabel: name, customShelf: name),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showSettings(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => Consumer(builder: (ctx, ref, _) {
        final mode = ref.watch(themeModeProvider);
        return SafeArea(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            ListTile(title: Text('Appearance', style: ctx.text.titleMedium)),
            RadioGroup<ThemeMode>(
              groupValue: mode,
              onChanged: (m) => ref.read(themeModeProvider.notifier).set(m!),
              child: const Column(children: [
                RadioListTile(value: ThemeMode.system, title: Text('Match system')),
                RadioListTile(value: ThemeMode.light, title: Text('Light')),
                RadioListTile(value: ThemeMode.dark, title: Text('Dark')),
              ]),
            ),
            const Divider(),
            ListTile(
              leading: Icon(Icons.logout, color: ctx.colors.danger),
              title: Text('Log out', style: TextStyle(color: ctx.colors.danger, fontWeight: FontWeight.w600)),
              onTap: () async {
                Navigator.pop(ctx);
                await ref.read(authProvider.notifier).logout();
              },
            ),
          ]),
        );
      }),
    );
  }

  void _manageShelves(BuildContext context, WidgetRef ref, AppUser user) {
    showModalBottomSheet(context: context, isScrollControlled: true, builder: (_) => const _ManageShelvesSheet());
  }
}

class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  _TabBarDelegate(this.tabBar, this.background);
  final TabBar tabBar;
  final Color background;

  @override
  double get minExtent => tabBar.preferredSize.height;
  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) => ColoredBox(color: background, child: tabBar);

  @override
  bool shouldRebuild(_TabBarDelegate oldDelegate) => oldDelegate.tabBar != tabBar || oldDelegate.background != background;
}

class _ProfileHeader extends ConsumerStatefulWidget {
  const _ProfileHeader({required this.user});
  final AppUser user;

  @override
  ConsumerState<_ProfileHeader> createState() => _ProfileHeaderState();
}

class _ProfileHeaderState extends ConsumerState<_ProfileHeader> {
  bool _uploading = false;

  Future<void> _changePhoto() async {
    final picked = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 800, maxHeight: 800, imageQuality: 85);
    if (picked == null) return;
    if (await picked.length() > 2 * 1024 * 1024) {
      if (mounted) showSnack(context, 'Images must be 2 MB or smaller.');
      return;
    }
    setState(() => _uploading = true);
    try {
      final updated = await ref.read(apiProvider).uploadPhoto(picked.path, picked.name);
      await ref.read(authProvider.notifier).updateUser(updated);
      if (mounted) showSnack(context, 'Profile photo updated');
    } catch (e) {
      if (mounted) showSnack(context, errorMessage(e, 'Could not upload the photo.'));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      child: Row(children: [
        Stack(children: [
          UserAvatar(name: widget.user.name, avatar: widget.user.avatar, radius: 34),
          Positioned(
            right: -4,
            bottom: -4,
            child: IconButton.filledTonal(
              tooltip: 'Change photo',
              iconSize: 16,
              visualDensity: VisualDensity.compact,
              onPressed: _uploading ? null : _changePhoto,
              icon: _uploading ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.photo_camera_outlined),
            ),
          ),
        ]),
        const SizedBox(width: 16),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(widget.user.name, style: context.text.headlineSmall),
            Text(widget.user.email, style: TextStyle(color: c.muted)),
          ]),
        ),
      ]),
    );
  }
}

class _StreakCard extends ConsumerStatefulWidget {
  const _StreakCard();

  @override
  ConsumerState<_StreakCard> createState() => _StreakCardState();
}

class _StreakCardState extends ConsumerState<_StreakCard> {
  bool _logging = false;

  Future<void> _log() async {
    setState(() => _logging = true);
    try {
      await ref.read(apiProvider).logReadingToday();
      ref.invalidate(readingActivityProvider);
      if (mounted) showSnack(context, 'Reading session logged. Keep the streak going!');
    } catch (e) {
      if (mounted) showSnack(context, errorMessage(e, 'Could not log your reading.'));
    } finally {
      if (mounted) setState(() => _logging = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final activity = ref.watch(readingActivityProvider);
    return _Card(
      child: activity.when(
        loading: () => const Skeleton(height: 120, radius: 12),
        error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(readingActivityProvider)),
        data: (a) {
          if (a == null) return const SizedBox.shrink();
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Icon(Icons.local_fire_department_rounded, color: Color(0xFFF97316)),
              const SizedBox(width: 6),
              Text('Reading streak', style: context.text.titleMedium),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              _Stat(value: '${a.currentStreak}', label: 'Current'),
              _Stat(value: '${a.longestStreak}', label: 'Longest'),
              _Stat(value: '${a.totalDaysRead}', label: 'Days read'),
            ]),
            const SizedBox(height: 12),
            _MiniHeatmap(activityMap: a.activityMap),
            const SizedBox(height: 12),
            a.todayLogged
                ? Row(children: [
                    Icon(Icons.check_circle, color: c.success, size: 20),
                    const SizedBox(width: 6),
                    Text("You've read today", style: TextStyle(color: c.success, fontWeight: FontWeight.w600)),
                  ])
                : FilledButton.icon(
                    onPressed: _logging ? null : _log,
                    icon: const Icon(Icons.menu_book_rounded),
                    label: Text(_logging ? 'Logging…' : 'I read today'),
                  ),
          ]);
        },
      ),
    );
  }
}

/// The last 12 weeks of reading, GitHub-style.
class _MiniHeatmap extends StatelessWidget {
  const _MiniHeatmap({required this.activityMap});
  final Map<String, int> activityMap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    const weeks = 12;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    // Columns are Sunday-first weeks; the last column is the current week
    final start = today.subtract(Duration(days: 7 * (weeks - 1) + (today.weekday % 7)));
    String key(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

    return LayoutBuilder(builder: (context, constraints) {
      final cell = ((constraints.maxWidth - (weeks - 1) * 4) / weeks).clamp(8.0, 18.0);
      return Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: List.generate(weeks, (w) {
          return Column(
            children: List.generate(7, (d) {
              final day = start.add(Duration(days: w * 7 + d));
              final count = day.isAfter(today) ? -1 : (activityMap[key(day)] ?? 0);
              final color = count < 0
                  ? Colors.transparent
                  : count == 0
                      ? c.surface
                      : Color.lerp(c.accent, c.success, (count / 4).clamp(0.0, 1.0))!;
              return Container(
                width: cell,
                height: cell,
                margin: const EdgeInsets.only(bottom: 4),
                decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(3), border: count == 0 ? Border.all(color: c.border) : null),
              );
            }),
          );
        }),
      );
    });
  }
}

class _ChallengeCard extends ConsumerWidget {
  const _ChallengeCard();

  Future<void> _editGoal(BuildContext context, WidgetRef ref, ReadingChallenge challenge) async {
    final controller = TextEditingController(text: '${challenge.target}');
    final target = await showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('${challenge.year} reading goal'),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(suffixText: 'books'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              final n = int.tryParse(controller.text.trim());
              if (n != null && n >= 1 && n <= 1000) Navigator.pop(ctx, n);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (target == null) return;
    try {
      await ref.read(apiProvider).setChallengeTarget(challenge.year, target);
      ref.invalidate(challengeProvider(challenge.year));
    } catch (e) {
      if (context.mounted) showSnack(context, errorMessage(e, 'Could not update your goal.'));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final year = DateTime.now().year;
    final challenge = ref.watch(challengeProvider(year));
    return _Card(
      child: challenge.when(
        loading: () => const Skeleton(height: 110, radius: 12),
        error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(challengeProvider(year))),
        data: (ch) {
          if (ch == null) return const SizedBox.shrink();
          final paceColor = switch (ch.paceStatus) {
            'behind' => const Color(0xFFD97706),
            'completed' || 'ahead' => c.success,
            _ => c.muted,
          };
          return Row(children: [
            SizedBox(
              width: 84,
              height: 84,
              child: Stack(fit: StackFit.expand, children: [
                CircularProgressIndicator(
                  value: (ch.completedCount / ch.target).clamp(0.0, 1.0),
                  strokeWidth: 8,
                  backgroundColor: c.border,
                  color: c.success,
                  strokeCap: StrokeCap.round,
                ),
                Center(
                  child: Text('${ch.percentage}%', style: context.text.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                ),
              ]),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${ch.year} challenge', style: context.text.titleMedium),
                const SizedBox(height: 2),
                Text('${ch.completedCount} of ${ch.target} books read', style: TextStyle(color: c.muted)),
                if (ch.paceMessage.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(ch.paceMessage, style: TextStyle(color: paceColor, fontWeight: FontWeight.w600, fontSize: 13)),
                ],
                TextButton.icon(
                  style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 36)),
                  onPressed: () => _editGoal(context, ref, ch),
                  icon: const Icon(Icons.edit_outlined, size: 16),
                  label: const Text('Edit goal'),
                ),
              ]),
            ),
          ]);
        },
      ),
    );
  }
}

class _ShelfGrid extends ConsumerWidget {
  const _ShelfGrid({required this.filter, required this.emptyLabel, this.customShelf});
  final bool Function(ShelfEntry) filter;
  final String emptyLabel;
  final String? customShelf;

  Future<void> _remove(BuildContext context, WidgetRef ref, Book book) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Remove from $emptyLabel?'),
        content: Text(book.title),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Remove')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final api = ref.read(apiProvider);
      if (customShelf != null) {
        await api.setCustomShelf(book.id, customShelf!, add: false);
      } else {
        await api.setStatus(book.id, null);
      }
      ref.invalidate(shelvesProvider);
      ref.invalidate(myShelfProvider(book.id));
    } catch (e) {
      if (context.mounted) showSnack(context, errorMessage(e, 'Could not remove the book.'));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shelves = ref.watch(shelvesProvider);
    return shelves.when(
      loading: () => const CustomScrollView(slivers: [SliverPadding(padding: EdgeInsets.all(16), sliver: BookGridSkeleton(count: 6))]),
      error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(shelvesProvider)),
      data: (entries) {
        final books = entries.where(filter).map((e) => e.book!).toList();
        if (books.isEmpty) {
          return ListView(children: [
            EmptyState(
              icon: Icons.collections_bookmark_outlined,
              title: 'Nothing on "$emptyLabel" yet',
              message: 'Add books from any book page, or swipe right in Discover.',
              action: OutlinedButton(onPressed: () => context.go('/discover'), child: const Text('Discover books')),
            ),
          ]);
        }
        return GridView.builder(
          padding: const EdgeInsets.all(16),
          gridDelegate: bookGridDelegate,
          itemCount: books.length,
          itemBuilder: (_, i) => GestureDetector(
            onLongPress: () => _remove(context, ref, books[i]),
            child: BookCard(book: books[i]),
          ),
        );
      },
    );
  }
}

class _ManageShelvesSheet extends ConsumerStatefulWidget {
  const _ManageShelvesSheet();

  @override
  ConsumerState<_ManageShelvesSheet> createState() => _ManageShelvesSheetState();
}

class _ManageShelvesSheetState extends ConsumerState<_ManageShelvesSheet> {
  final _name = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _add(AppUser user) async {
    final name = _name.text.trim();
    if (name.isEmpty) return;
    final reserved = ['read', 'want to read', 'want-to-read', 'reading', 'currently reading', 'currently-reading'];
    if (reserved.contains(name.toLowerCase())) {
      showSnack(context, 'That name is used by a built-in shelf.');
      return;
    }
    if (user.customShelves.any((s) => s.toLowerCase() == name.toLowerCase())) {
      showSnack(context, 'You already have that shelf.');
      return;
    }
    setState(() => _busy = true);
    try {
      final shelves = await ref.read(apiProvider).addCustomShelf(name);
      await ref.read(authProvider.notifier).updateUser(user.copyWith(customShelves: shelves));
      _name.clear();
    } catch (e) {
      if (mounted) showSnack(context, errorMessage(e, 'Could not create the shelf.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _remove(AppUser user, String shelf) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Delete "$shelf"?'),
        content: const Text('Books stay on your other shelves.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final shelves = await ref.read(apiProvider).removeCustomShelf(shelf);
      await ref.read(authProvider.notifier).updateUser(user.copyWith(customShelves: shelves));
      ref.invalidate(shelvesProvider);
    } catch (e) {
      if (mounted) showSnack(context, errorMessage(e, 'Could not delete the shelf.'));
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    if (user == null) return const SizedBox.shrink();
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.viewInsetsOf(context).bottom + 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Custom shelves', style: context.text.titleLarge),
          const SizedBox(height: 4),
          Text('Group books your way, like "Favorites of 2026" or "Did not finish".', style: TextStyle(color: context.colors.muted)),
          const SizedBox(height: 12),
          for (final s in user.customShelves)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.bookmark_outline),
              title: Text(s),
              trailing: IconButton(tooltip: 'Delete shelf', icon: const Icon(Icons.delete_outline), onPressed: () => _remove(user, s)),
            ),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
              child: TextField(
                controller: _name,
                maxLength: 50,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(hintText: 'New shelf name', counterText: ''),
                onSubmitted: (_) => _add(user),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(onPressed: _busy ? null : () => _add(user), child: const Text('Add')),
          ]),
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: c.border)),
      child: child,
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(value, style: context.text.headlineSmall),
        Text(label, style: TextStyle(color: context.colors.muted, fontSize: 12)),
      ]),
    );
  }
}
