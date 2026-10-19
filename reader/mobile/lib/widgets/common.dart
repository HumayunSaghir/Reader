import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:go_router/go_router.dart';

import '../core/api_client.dart';
import '../core/theme.dart';
import '../models/models.dart';

void showSnack(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message), duration: const Duration(seconds: 3)));
}

/// Animated shimmer placeholder shaped like the content it stands in for.
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.width, this.height = 14, this.radius = 6});
  final double? width;
  final double height;
  final double radius;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = _controller.value * 3 - 1;
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.radius),
            gradient: LinearGradient(begin: Alignment(t - 1, 0), end: Alignment(t + 1, 0), colors: [c.skeleton, c.skeletonShine, c.skeleton]),
          ),
        );
      },
    );
  }
}

/// Book cover with caching, shimmer while loading and a placeholder fallback.
class CoverImage extends StatelessWidget {
  const CoverImage({super.key, required this.url, this.size = 'M', this.width, this.height, this.radius = 6});
  final String? url;
  final String size;
  final double? width;
  final double? height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final src = coverUrl(url, size);
    final placeholder = _CoverPlaceholder(radius: radius);
    // Decode at the size it's shown, not the file's full resolution: much less
    // decoding work and memory per cover, which keeps long grids scrolling smoothly.
    // Grid cards have no fixed width; they're at most 140 wide.
    final displayWidth = width ?? (size == 'L' ? 320 : 140);
    final decodeWidth = (displayWidth * MediaQuery.devicePixelRatioOf(context)).round();
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(
        width: width,
        height: height,
        child: src == null
            ? placeholder
            : CachedNetworkImage(
                imageUrl: src,
                fit: BoxFit.cover,
                memCacheWidth: decodeWidth,
                fadeInDuration: const Duration(milliseconds: 150),
                placeholder: (_, _) => Skeleton(radius: radius, height: double.infinity),
                errorWidget: (_, failedUrl, error) {
                  if (kDebugMode) debugPrint('Cover failed: $failedUrl ($error)');
                  _evictBrokenCover(failedUrl);
                  return placeholder;
                },
              ),
      ),
    );
  }
}

// A download interrupted mid-way (app killed, network dropped) can leave an
// empty or truncated file in the image cache. Covers are served as immutable,
// so the cache would keep that broken file for a year. Evict it so the next
// time the cover is shown it downloads again (once per URL per session, so a
// genuinely broken image can't cause a retry loop).
final _evictedCovers = <String>{};

void _evictBrokenCover(String url) {
  if (_evictedCovers.add(url)) {
    CachedNetworkImage.evictFromCache(url);
  }
}

class _CoverPlaceholder extends StatelessWidget {
  const _CoverPlaceholder({required this.radius});
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(radius)),
      alignment: Alignment.center,
      child: const Icon(Icons.menu_book_rounded, color: Color(0xFF94A3B8), size: 32),
    );
  }
}

/// Cover-first book tile used in every grid.
class BookCard extends StatelessWidget {
  const BookCard({super.key, required this.book});
  final Book book;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: () => context.push('/books/${book.id}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 2 / 3,
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(6),
                // A small blur: large shadow blurs on every card are costly to draw while scrolling
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.16), blurRadius: 6, offset: const Offset(0, 3))],
              ),
              child: CoverImage(url: book.coverImage),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            book.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: context.text.bodySmall?.copyWith(fontWeight: FontWeight.w700, height: 1.25, color: c.text),
          ),
          const SizedBox(height: 2),
          Text(
            book.author,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: context.text.bodySmall?.copyWith(color: c.muted, fontSize: 11.5),
          ),
        ],
      ),
    );
  }
}

const bookGridDelegate = SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 140, mainAxisSpacing: 18, crossAxisSpacing: 14, childAspectRatio: 0.48);

class BookGridSkeleton extends StatelessWidget {
  const BookGridSkeleton({super.key, this.count = 9});
  final int count;

  @override
  Widget build(BuildContext context) {
    return SliverGrid.builder(
      gridDelegate: bookGridDelegate,
      itemCount: count,
      itemBuilder: (_, _) => const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 2 / 3,
            child: Skeleton(height: double.infinity),
          ),
          SizedBox(height: 8),
          Skeleton(height: 11),
          SizedBox(height: 6),
          Skeleton(height: 10, width: 60),
        ],
      ),
    );
  }
}

class UserAvatar extends StatelessWidget {
  const UserAvatar({super.key, required this.name, this.avatar, this.radius = 18});
  final String name;
  final String? avatar;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final url = assetUrl(avatar);
    return CircleAvatar(
      radius: radius,
      backgroundColor: c.button,
      foregroundImage: url == null ? null : CachedNetworkImageProvider(url),
      child: Text(
        name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: TextStyle(color: c.onButton, fontWeight: FontWeight.w700, fontSize: radius * 0.8),
      ),
    );
  }
}

class StarRow extends StatelessWidget {
  const StarRow({super.key, required this.rating, this.size = 14});
  final int rating;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) => Icon(i < rating ? Icons.star_rounded : Icons.star_outline_rounded, size: size, color: i < rating ? c.star : c.border)),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.title, this.message, this.icon = Icons.auto_stories_outlined, this.action});
  final String title;
  final String? message;
  final IconData icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    // Centered in whatever space it's given (a whole screen body, a list, or a sliver)
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44, color: c.muted),
            const SizedBox(height: 14),
            Text(title, textAlign: TextAlign.center, style: context.text.titleLarge),
            if (message != null) ...[
              const SizedBox(height: 6),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: TextStyle(color: c.muted),
              ),
            ],
            if (action != null) ...[const SizedBox(height: 18), action!],
          ],
        ),
      ),
    );
  }
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, required this.onRetry, this.title = "Couldn't load this"});
  final Object error;
  final VoidCallback onRetry;
  final String title;

  @override
  Widget build(BuildContext context) {
    return EmptyState(
      icon: Icons.cloud_off_rounded,
      title: title,
      message: errorMessage(error),
      action: OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('Try again')),
    );
  }
}

/// Shown on screens that need an account.
class SignInPrompt extends StatelessWidget {
  const SignInPrompt({super.key, required this.message, this.icon = Icons.lock_outline_rounded});
  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: EmptyState(
        icon: icon,
        title: 'Sign in to continue',
        message: message,
        action: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            FilledButton(onPressed: () => context.push('/login'), child: const Text('Log in')),
            const SizedBox(width: 12),
            OutlinedButton(onPressed: () => context.push('/register'), child: const Text('Sign up')),
          ],
        ),
      ),
    );
  }
}

/// Markdown body styled to match the app (descriptions and AI answers).
class MarkdownText extends StatelessWidget {
  const MarkdownText(this.data, {super.key, this.fontSize = 15});
  final String data;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final base = TextStyle(fontSize: fontSize, height: 1.6, color: c.text);
    return MarkdownBody(
      data: data,
      softLineBreak: true,
      styleSheet: MarkdownStyleSheet(
        p: base,
        strong: base.copyWith(fontWeight: FontWeight.w700),
        em: base.copyWith(fontStyle: FontStyle.italic),
        listBullet: base,
        a: base.copyWith(decoration: TextDecoration.underline),
        blockSpacing: 10,
      ),
    );
  }
}

/// Plain text from descriptions that may contain simple HTML.
String cleanDescription(String text) => text
    .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
    .replaceAll(RegExp(r'</p>\s*<p>', caseSensitive: false), '\n\n')
    .replaceAll(RegExp(r'<[^>]+>'), '')
    .replaceAll('\r\n', '\n')
    .trim();

String timeAgo(DateTime? date) {
  if (date == null) return '';
  final diff = DateTime.now().difference(date);
  if (diff.inMinutes < 1) return 'just now';
  if (diff.inHours < 1) return '${diff.inMinutes}m ago';
  if (diff.inDays < 1) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  if (diff.inDays < 365) return '${(diff.inDays / 7).floor()}w ago';
  return '${(diff.inDays / 365).floor()}y ago';
}
