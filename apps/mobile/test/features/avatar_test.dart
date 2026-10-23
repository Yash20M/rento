import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/core/media/photo_picker.dart';

import '../support/fixtures.dart';
import '../support/harness.dart';
import '../support/stub_http_adapter.dart';

/// P3-44 — the profile photo: change it from the camera or gallery, remove it, and see it on the account screen at
/// once. The picture comes from a fake picker; the server's answers are stubbed.
final _png = Uint8List.fromList([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  1,
  2,
  3,
]);
const _profile = {
  'id': 'u-1',
  'email': 'asha@example.com',
  'displayName': 'Asha',
  'phone': null,
  'emailVerified': true,
  'avatarUrl': null,
  'needsProfileCompletion': <String>[],
};

FakeApi _api({Object? post, Object? delete}) => FakeApi({
  'GET /v1/drawers': const StubResponse(200, <Object>[]),
  'GET /v1/me/kyc': const StubResponse(200, {
    'required': true,
    'status': 'none',
    'maskedAadhaar': null,
    'verifiedAt': null,
    'verifiedName': null,
    'reason': null,
  }),
  'POST /v1/me/avatar':
      post ?? StubResponse(200, {..._profile, 'avatarUrl': '/v1/media/m-1'}),
  'DELETE /v1/me/avatar': delete ?? const StubResponse(200, _profile),
});

Future<void> _account(
  WidgetTester tester,
  FakeApi api,
  FakePhotoPicker picker, {
  String? avatar,
}) async {
  if (avatar != null) {
    api.on(
      'POST /v1/auth/refresh',
      StubResponse(200, authJson(user: {...userJson(), 'avatarUrl': avatar})),
    );
  }
  await pumpApp(
    tester,
    api,
    signedIn: avatar == null,
    savedRefreshToken: avatar == null ? null : 'refresh-0',
    picker: picker,
  );
  await tester.tap(find.text('Account').first);
  await tester.pumpAndSettle();
}

/// The photo address the avatar is trying to show (null = the initial letter).
String? _photo(WidgetTester tester) {
  final images = find.descendant(
    of: find.byKey(const Key('avatar')),
    matching: find.byType(Image),
  );
  if (images.evaluate().isEmpty) return null;
  final provider = tester.widget<Image>(images.first).image;
  return provider is NetworkImage ? provider.url : null;
}

void main() {
  testWidgets(
    'H-01 no photo yet: the initial letter, and the sheet offers camera and gallery only',
    (tester) async {
      await _account(tester, _api(), FakePhotoPicker(null));
      expect(_photo(tester), isNull);
      await tester.tap(find.byKey(const Key('change-photo')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('photo-take')), findsOneWidget);
      expect(find.byKey(const Key('photo-choose')), findsOneWidget);
      expect(find.byKey(const Key('photo-remove')), findsNothing);
    },
  );

  testWidgets(
    'H-02 choosing from the gallery uploads the picture as sent and shows the new photo at once',
    (tester) async {
      final api = _api();
      final picker = FakePhotoPicker(
        PickedPhoto(bytes: _png, contentType: 'image/png'),
      );
      await _account(tester, api, picker);
      await tester.tap(find.byKey(const Key('change-photo')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('photo-choose')));
      await tester.pumpAndSettle();

      expect(picker.asked, [PhotoSource.gallery]);
      final sent = api.to('POST', '/v1/me/avatar').single;
      expect(sent.contentType, contains('image/png'));
      expect(find.text('Photo updated'), findsOneWidget);
      expect(_photo(tester), 'http://api.test/v1/media/m-1');
    },
  );

  testWidgets('H-03 the camera works the same way', (tester) async {
    final api = _api();
    final picker = FakePhotoPicker(
      PickedPhoto(bytes: _png, contentType: 'image/jpeg'),
    );
    await _account(tester, api, picker);
    await tester.tap(find.byKey(const Key('change-photo')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('photo-take')));
    await tester.pumpAndSettle();
    expect(picker.asked, [PhotoSource.camera]);
    expect(api.to('POST', '/v1/me/avatar'), hasLength(1));
  });

  testWidgets('H-04 backing out of the picker sends nothing', (tester) async {
    final api = _api();
    await _account(tester, api, FakePhotoPicker(null));
    await tester.tap(find.byKey(const Key('change-photo')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('photo-choose')));
    await tester.pumpAndSettle();
    expect(api.to('POST', '/v1/me/avatar'), isEmpty);
  });

  testWidgets('H-05 a refused picture is explained and the old state stays', (
    tester,
  ) async {
    final api = _api(
      post: StubResponse(422, problemJson(422, 'VALIDATION_FAILED')),
    );
    await _account(
      tester,
      api,
      FakePhotoPicker(PickedPhoto(bytes: _png, contentType: 'image/png')),
    );
    await tester.tap(find.byKey(const Key('change-photo')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('photo-choose')));
    await tester.pumpAndSettle();
    expect(find.textContaining('could not be saved'), findsOneWidget);
    expect(_photo(tester), isNull);
  });

  testWidgets(
    'H-06 with a photo, "Remove photo" appears, deletes it and goes back to the initial',
    (tester) async {
      final api = _api();
      await _account(
        tester,
        api,
        FakePhotoPicker(null),
        avatar: '/v1/media/m-9',
      );
      expect(_photo(tester), 'http://api.test/v1/media/m-9');
      await tester.tap(find.byKey(const Key('change-photo')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('photo-remove')));
      await tester.pumpAndSettle();
      expect(api.to('DELETE', '/v1/me/avatar'), hasLength(1));
      expect(find.text('Photo removed'), findsOneWidget);
      expect(_photo(tester), isNull);
    },
  );

  testWidgets('H-07 the photo button has a spoken name', (tester) async {
    final handle = tester.ensureSemantics();
    await _account(tester, _api(), FakePhotoPicker(null));
    expect(
      tester.getSemantics(find.byKey(const Key('change-photo'))).label,
      contains('Change photo'),
    );
    handle.dispose();
  });

  testWidgets(
    'H-08 the message from the last change never floats over the choices when the sheet opens again',
    (tester) async {
      final api = _api();
      await _account(
        tester,
        api,
        FakePhotoPicker(PickedPhoto(bytes: _png, contentType: 'image/png')),
      );
      await tester.tap(find.byKey(const Key('change-photo')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('photo-choose')));
      await tester.pumpAndSettle();
      expect(find.text('Photo updated'), findsOneWidget);

      await tester.tap(find.byKey(const Key('change-photo')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('photo-remove')), findsOneWidget);
      expect(find.text('Photo updated'), findsNothing);
    },
  );
}
