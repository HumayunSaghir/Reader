import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/auth_screens.dart';
import '../features/books/book_detail_screen.dart';
import '../features/clubs/club_detail_screen.dart';
import '../features/clubs/clubs_screen.dart';
import '../features/discover/discover_screen.dart';
import '../features/home/home_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/search/search_screen.dart';
import '../features/tags/tags_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => AppShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/', builder: (_, _) => const HomeScreen())]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/discover',
              builder: (_, state) => DiscoverScreen(tags: _tagsFrom(state)),
            ),
          ]),
          StatefulShellBranch(routes: [GoRoute(path: '/clubs', builder: (_, _) => const ClubsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen())]),
        ],
      ),
      GoRoute(path: '/books/:id', builder: (_, state) => BookDetailScreen(bookId: state.pathParameters['id']!)),
      GoRoute(path: '/clubs/:id', builder: (_, state) => ClubDetailScreen(clubId: state.pathParameters['id']!)),
      GoRoute(path: '/search', builder: (_, state) => SearchScreen(initialQuery: state.uri.queryParameters['q'] ?? '')),
      GoRoute(path: '/tags', builder: (_, state) => TagsScreen(initialTags: _tagsFrom(state))),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, _) => const RegisterScreen()),
    ],
    errorBuilder: (context, state) => Scaffold(
      appBar: AppBar(),
      body: const Center(child: Text('Page not found')),
    ),
  );
});

List<String> _tagsFrom(GoRouterState state) =>
    (state.uri.queryParameters['tags'] ?? '').split(',').map((t) => t.trim()).where((t) => t.isNotEmpty).toList();

class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: shell.currentIndex,
        // Tapping the current tab returns it to its first screen
        onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.style_outlined), selectedIcon: Icon(Icons.style_rounded), label: 'Swipe'),
          NavigationDestination(icon: Icon(Icons.groups_outlined), selectedIcon: Icon(Icons.groups_rounded), label: 'Clubs'),
          NavigationDestination(icon: Icon(Icons.bookmarks_outlined), selectedIcon: Icon(Icons.bookmarks_rounded), label: 'My Books'),
        ],
      ),
    );
  }
}
