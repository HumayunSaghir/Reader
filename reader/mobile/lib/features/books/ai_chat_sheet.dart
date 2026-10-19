import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../data/reader_api.dart';
import '../../models/models.dart';
import '../../state/providers.dart';
import '../../widgets/common.dart';

void showAiChat(BuildContext context, Book book) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => _AiChatSheet(book: book),
  );
}

class _ChatMessage {
  _ChatMessage(this.fromUser, this.text, {this.isError = false});
  final bool fromUser;
  final String text;
  final bool isError;
}

class _AiChatSheet extends ConsumerStatefulWidget {
  const _AiChatSheet({required this.book});
  final Book book;

  @override
  ConsumerState<_AiChatSheet> createState() => _AiChatSheetState();
}

class _AiChatSheetState extends ConsumerState<_AiChatSheet> {
  // The server only uses the last few turns; sending more just costs bandwidth
  static const _historyLimit = 8;

  final _input = TextEditingController();
  final _scroll = ScrollController();
  final List<_ChatMessage> _messages = [];
  bool _waiting = false;

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      }
    });
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _waiting) return;
    final history = _messages
        .where((m) => !m.isError)
        .toList()
        .reversed
        .take(_historyLimit)
        .toList()
        .reversed
        .map((m) => {'role': m.fromUser ? 'user' : 'model', 'content': m.text})
        .toList();

    setState(() {
      _messages.add(_ChatMessage(true, text));
      _waiting = true;
    });
    _input.clear();
    _scrollToEnd();

    try {
      final reply = await ref.read(apiProvider).chat(widget.book.id, text, history);
      if (mounted) setState(() => _messages.add(_ChatMessage(false, reply)));
    } catch (e) {
      if (mounted) setState(() => _messages.add(_ChatMessage(false, errorMessage(e, 'The AI could not answer right now.'), isError: true)));
    } finally {
      if (mounted) setState(() => _waiting = false);
      _scrollToEnd();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final signedIn = ref.watch(currentUserProvider) != null;
    final suggestions = ['What are the main themes?', 'Is it a slow start?', 'Who would enjoy this?'];

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.85,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 8, 8),
              child: Row(children: [
                const Icon(Icons.auto_awesome, color: Color(0xFF10B981)),
                const SizedBox(width: 8),
                Expanded(child: Text('Book Sommelier', style: context.text.titleLarge)),
                IconButton(tooltip: 'Close', onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
              ]),
            ),
            const Divider(),
            Expanded(
              child: !signedIn
                  ? SignInPrompt(message: 'Log in to chat about ${widget.book.title}.', icon: Icons.auto_awesome)
                  : ListView(
                      controller: _scroll,
                      padding: const EdgeInsets.all(16),
                      children: [
                        if (_messages.isEmpty) ...[
                          Text('Ask anything about ${widget.book.title}: themes, characters, or whether it\'s right for you. Spoiler-free unless you ask.',
                              textAlign: TextAlign.center, style: TextStyle(color: c.muted)),
                          const SizedBox(height: 16),
                          Wrap(
                            alignment: WrapAlignment.center,
                            spacing: 8,
                            runSpacing: 8,
                            children: suggestions
                                .map((s) => ActionChip(label: Text(s), onPressed: () {
                                      _input.text = s;
                                      _send();
                                    }))
                                .toList(),
                          ),
                        ],
                        for (final m in _messages) _Bubble(message: m),
                        if (_waiting) const _TypingBubble(),
                      ],
                    ),
            ),
            if (signedIn)
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
                  child: Row(children: [
                    Expanded(
                      child: TextField(
                        controller: _input,
                        maxLength: 1000,
                        minLines: 1,
                        maxLines: 4,
                        textCapitalization: TextCapitalization.sentences,
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => _send(),
                        decoration: const InputDecoration(hintText: 'Ask about the book…', counterText: ''),
                      ),
                    ),
                    const SizedBox(width: 4),
                    IconButton.filled(tooltip: 'Send', onPressed: _waiting ? null : _send, icon: const Icon(Icons.arrow_upward_rounded)),
                  ]),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});
  final _ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final fromUser = message.fromUser;
    return Align(
      alignment: fromUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.8),
        decoration: BoxDecoration(
          color: fromUser ? c.accent : c.surface,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(fromUser ? 16 : 4),
            bottomRight: Radius.circular(fromUser ? 4 : 16),
          ),
        ),
        child: message.isError
            ? Text(message.text, style: TextStyle(color: c.danger))
            : fromUser
                ? Text(message.text)
                : MarkdownText(message.text, fontSize: 14),
      ),
    );
  }
}

class _TypingBubble extends StatefulWidget {
  const _TypingBubble();

  @override
  State<_TypingBubble> createState() => _TypingBubbleState();
}

class _TypingBubbleState extends State<_TypingBubble> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(16)),
        child: AnimatedBuilder(
          animation: _controller,
          builder: (_, _) => Row(
            mainAxisSize: MainAxisSize.min,
            children: List.generate(3, (i) {
              final phase = (_controller.value - i * 0.15) % 1.0;
              final lift = phase < 0.3 ? (phase / 0.3) : phase < 0.6 ? (1 - (phase - 0.3) / 0.3) : 0.0;
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: Transform.translate(
                  offset: Offset(0, -4 * lift),
                  child: Container(width: 7, height: 7, decoration: BoxDecoration(color: c.muted, shape: BoxShape.circle)),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}
