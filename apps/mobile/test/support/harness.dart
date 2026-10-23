import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rento_mobile/app/app.dart';
import 'package:rento_mobile/app/config/env.dart';
import 'package:rento_mobile/app/providers.dart';
import 'package:rento_mobile/core/location/location_service.dart';
import 'package:rento_mobile/core/media/photo_picker.dart';
import 'package:rento_mobile/core/storage/secure_store.dart';

import 'fixtures.dart';
import 'stub_http_adapter.dart';

typedef Handler = StubResponse Function(RequestOptions options);

const devEnv = AppEnv(flavor: Flavor.dev, apiBaseUrl: 'http://api.test');
const prodEnv = AppEnv(
  flavor: Flavor.prod,
  apiBaseUrl: 'https://api.rento.example',
);

/// A stand-in API: routes like `'GET /v1/bookings/b-1'` map to a handler or a fixed answer. Every request is recorded.
/// Unknown routes answer a 404 problem so a missing stub fails loudly in the screen under test.
class FakeApi {
  FakeApi(Map<String, Object> routes) {
    routes.forEach(on);
    adapter = StubHttpAdapter(_answer);
  }

  final Map<String, Handler> _routes = {};
  late final StubHttpAdapter adapter;

  List<RequestOptions> get requests => adapter.requests;

  /// `handler` is a [Handler] or a ready [StubResponse].
  void on(String route, Object handler) {
    _routes[route] =
        handler is Handler ? handler : (_) => handler as StubResponse;
  }

  /// Requests to a route, e.g. `api.to('POST', '/v1/bookings')`.
  List<RequestOptions> to(String method, String path) =>
      requests.where((r) => r.method == method && r.path == path).toList();

  StubResponse _answer(RequestOptions options) {
    final handler = _routes['${options.method} ${options.path}'];
    if (handler == null) {
      return StubResponse(
        404,
        problemJson(
          404,
          'NOT_FOUND',
          detail: 'No stub for ${options.method} ${options.path}',
        ),
      );
    }
    return handler(options);
  }
}

class FakeLocation implements LocationService {
  FakeLocation({this.point, this.failure});

  final GeoPoint? point;
  final LocationFailure? failure;
  int calls = 0;

  @override
  Future<GeoPoint> current() async {
    calls++;
    if (failure != null) throw LocationException(failure!);
    return point ?? const GeoPoint(latitude: 12.9784, longitude: 77.6408);
  }
}

/// The clock the app sees; tests move it instead of waiting.
class FakeNow {
  FakeNow(this.value);

  DateTime value;

  DateTime call() => value;

  void advance(Duration by) => value = value.add(by);
}

class Pumped {
  Pumped(this.container, this.store, this.now);

  final ProviderContainer container;
  final InMemorySecureStore store;
  final FakeNow now;
}

/// Boots the whole app on [api]. With [signedIn] a refresh token is waiting (as after an app restart) and the stub
/// must answer `POST /v1/auth/refresh`.
Future<Pumped> pumpApp(
  WidgetTester tester,
  FakeApi api, {
  AppEnv env = devEnv,
  bool signedIn = false,
  String? savedRefreshToken,
  FakeNow? now,
  LocationService? location,
  Size size = const Size(420, 900),
  List<Duration> retryDelays = const [],
  InMemorySecureStore? store,
  PhotoPicker? picker,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  store ??= InMemorySecureStore();
  if (signedIn) {
    await store.write('refresh_token', 'refresh-0');
    api.on('POST /v1/auth/refresh', StubResponse(200, authJson()));
  }
  if (savedRefreshToken != null) {
    await store.write('refresh_token', savedRefreshToken);
  }
  final clock = now ?? FakeNow(DateTime.utc(2030, 1, 7, 3, 0));
  final container = ProviderContainer(
    retry: (_, _) => null,
    overrides: [
      envProvider.overrideWithValue(env),
      secureStoreProvider.overrideWithValue(store),
      httpAdapterProvider.overrideWithValue(api.adapter),
      clockProvider.overrideWithValue(clock.call),
      locationServiceProvider.overrideWithValue(location ?? FakeLocation()),
      // No automatic repeats unless a test asks for them: request counts stay exact.
      retryDelaysProvider.overrideWithValue(retryDelays),
      if (picker != null) photoPickerProvider.overrideWithValue(picker),
    ],
  );
  addTearDown(container.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(container: container, child: const RentoApp()),
  );
  await tester.pumpAndSettle();
  return Pumped(container, store, clock);
}

/// Types into the text field that has [label].
Future<void> enterText(WidgetTester tester, String label, String text) async {
  await tester.enterText(find.widgetWithText(TextField, label), text);
  await tester.pump();
}

/// Hands over a ready-made picture instead of opening the camera or gallery.
class FakePhotoPicker implements PhotoPicker {
  FakePhotoPicker(this.photo);

  /// `null` = the person backed out.
  final PickedPhoto? photo;
  final List<PhotoSource> asked = [];

  @override
  Future<PickedPhoto?> pick(PhotoSource source) async {
    asked.add(source);
    return photo;
  }
}
