import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/core/ui/motion.dart';

/// P3-47 — the small motion: lists slide and fade in, cards answer a press, the success tick pops — and none of it
/// plays for someone who turned animations off.
Widget _host(Widget child, {bool reduce = false}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(disableAnimations: reduce),
    child: Scaffold(body: Center(child: child)),
  ),
);

double _opacity(WidgetTester tester) =>
    tester.widget<Opacity>(find.byType(Opacity).first).opacity;

void main() {
  testWidgets(
    'M-01 a list item starts transparent and is fully visible once the motion ends',
    (tester) async {
      await tester.pumpWidget(_host(const FadeSlideIn(child: Text('hello'))));
      expect(_opacity(tester), lessThan(1));
      await tester.pumpAndSettle();
      expect(_opacity(tester), 1);
      expect(find.text('hello'), findsOneWidget);
    },
  );

  testWidgets(
    'M-02 later items start later (a stagger), but never later than a few steps',
    (tester) async {
      await tester.pumpWidget(
        _host(
          const Column(
            children: [
              FadeSlideIn(index: 0, child: Text('first')),
              FadeSlideIn(index: 5, child: Text('sixth')),
              FadeSlideIn(index: 50, child: Text('fifty-first')),
            ],
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 120));
      final opacities =
          tester
              .widgetList<Opacity>(find.byType(Opacity))
              .map((o) => o.opacity)
              .toList();
      expect(
        opacities[0],
        greaterThan(opacities[1]),
        reason: 'the first is ahead of the sixth',
      );
      await tester.pump(const Duration(milliseconds: 700));
      expect(
        tester
            .widgetList<Opacity>(find.byType(Opacity))
            .every((o) => o.opacity == 1),
        isTrue,
        reason: 'even item 50 is done within a second',
      );
    },
  );

  testWidgets(
    'M-03 with animations turned off the content is there at once, untouched',
    (tester) async {
      await tester.pumpWidget(
        _host(const FadeSlideIn(child: Text('hello')), reduce: true),
      );
      expect(find.byType(Opacity), findsNothing);
      expect(find.text('hello'), findsOneWidget);
    },
  );

  testWidgets(
    'M-04 a card shrinks a hair while pressed and springs back on release',
    (tester) async {
      await tester.pumpWidget(
        _host(const PressScale(child: SizedBox(width: 100, height: 100))),
      );
      double scale() =>
          tester.widget<AnimatedScale>(find.byType(AnimatedScale)).scale;
      expect(scale(), 1);
      final gesture = await tester.startGesture(
        tester.getCenter(find.byType(PressScale)),
      );
      await tester.pump();
      expect(scale(), lessThan(1));
      await gesture.up();
      await tester.pump();
      expect(scale(), 1);
    },
  );

  testWidgets('M-05 a press does nothing visual when animations are off', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(
        const PressScale(child: SizedBox(width: 100, height: 100)),
        reduce: true,
      ),
    );
    expect(find.byType(AnimatedScale), findsNothing);
  });

  testWidgets(
    'M-06 the success tick pops in with a little overshoot and settles at full size',
    (tester) async {
      await tester.pumpWidget(_host(const PopIn(child: Icon(Icons.check))));
      double scale() =>
          tester
              .widget<Transform>(
                find
                    .descendant(
                      of: find.byType(PopIn),
                      matching: find.byType(Transform),
                    )
                    .first,
              )
              .transform
              .storage[0]; // the horizontal scale (the z scale is always 1)
      expect(scale(), lessThan(0.6));
      await tester.pump(const Duration(milliseconds: 150));
      expect(scale(), greaterThan(0.6));
      await tester.pumpAndSettle();
      expect(scale(), closeTo(1, 0.001));
    },
  );
}
