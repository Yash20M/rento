import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/app/env_error_app.dart';

void main() {
  testWidgets(
    'B-01 an invalid environment shows a readable message, not a blank screen',
    (tester) async {
      await tester.pumpWidget(
        const EnvErrorApp(
          message: 'API_BASE_URL is required for the "staging" flavor.',
        ),
      );

      expect(find.text('Rento cannot start'), findsOneWidget);
      expect(
        find.text('API_BASE_URL is required for the "staging" flavor.'),
        findsOneWidget,
      );
    },
  );
}
