import 'package:flutter/material.dart';

/// Small, quick motion that makes the app feel alive — and none at all for people who turned animations off
/// (system setting "remove animations"): every piece here shows its final state at once in that case.

/// Slides a little and fades in the first time it appears; [index] staggers the items of a list.
class FadeSlideIn extends StatelessWidget {
  const FadeSlideIn({super.key, required this.child, this.index = 0});

  final Widget child;
  final int index;

  /// Lists stop staggering after a few items so a long list never makes the last one wait.
  static const _maxStagger = 6;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return child;
    final delay = Duration(milliseconds: 45 * index.clamp(0, _maxStagger));
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 320) + delay,
      curve: Interval(
        delay.inMilliseconds / (320 + delay.inMilliseconds),
        1,
        curve: Curves.easeOutCubic,
      ),
      child: child,
      builder:
          (context, t, child) => Opacity(
            opacity: t,
            child: Transform.translate(
              offset: Offset(0, 14 * (1 - t)),
              child: child,
            ),
          ),
    );
  }
}

/// Shrinks a hair while pressed, springing back on release — feedback that the card heard the tap.
class PressScale extends StatefulWidget {
  const PressScale({super.key, required this.child});

  final Widget child;

  @override
  State<PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends State<PressScale> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return widget.child;
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => setState(() => _down = true),
      onPointerUp: (_) => setState(() => _down = false),
      onPointerCancel: (_) => setState(() => _down = false),
      child: AnimatedScale(
        scale: _down ? 0.975 : 1,
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}

/// Pops in with a little overshoot (the success tick).
class PopIn extends StatelessWidget {
  const PopIn({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.4, end: 1),
      duration: const Duration(milliseconds: 520),
      curve: Curves.elasticOut,
      child: child,
      builder:
          (context, scale, child) =>
              Transform.scale(scale: scale, child: child),
    );
  }
}
