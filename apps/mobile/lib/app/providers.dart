import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api/api_client.dart';
import '../core/api/auth_api.dart';
import '../core/api/booking_api.dart';
import '../core/api/catalog_api.dart';
import '../core/api/kyc_api.dart';
import '../core/api/me_api.dart';
import '../core/auth/auth_controller.dart';
import '../core/auth/session_store.dart';
import '../core/cache/read_cache.dart';
import '../core/net/connectivity.dart';
import '../core/location/location_service.dart';
import '../core/media/photo_picker.dart';
import '../core/storage/secure_store.dart';
import 'config/env.dart';
import 'router.dart';

/// The build configuration. Must be overridden at the root `ProviderScope` — there is deliberately no
/// default, so a missing override fails loudly instead of silently talking to the wrong backend.
final envProvider = Provider<AppEnv>(
  (ref) =>
      throw StateError(
        'envProvider must be overridden in the root ProviderScope.',
      ),
);

final secureStoreProvider = Provider<SecureStore>(
  (ref) => FlutterSecureStore(),
);

final readCacheProvider = Provider<ReadCache>(
  (ref) => ReadCache(ref.watch(secureStoreProvider)),
);

/// Pauses before repeating a failed GET. Tests set this to nothing (or to zero pauses) so they never wait.
final retryDelaysProvider = Provider<List<Duration>>(
  (ref) => defaultRetryDelays,
);

final sessionStoreProvider = Provider<SessionStore>((ref) {
  final cache = ref.watch(readCacheProvider);
  final store = SessionStore(
    ref.watch(secureStoreProvider),
    onCleared: cache.clear,
  );
  ref.onDispose(store.dispose);
  return store;
});

/// Tests replace the network with a stub adapter; production leaves this null.
final httpAdapterProvider = Provider<HttpClientAdapter?>((ref) => null);

final dioProvider = Provider<Dio>(
  (ref) => buildDio(
    ref.watch(envProvider),
    session: ref.watch(sessionStoreProvider),
    adapter: ref.watch(httpAdapterProvider),
    // Tests replace the network and read the stub's record instead of the console.
    enableLogging: kDebugMode && ref.watch(httpAdapterProvider) == null,
    cache: ref.watch(readCacheProvider),
    retryDelays: ref.watch(retryDelaysProvider),
    onReachability:
        (online) => ref.read(onlineProvider.notifier).report(online),
  ),
);

final authApiProvider = Provider<AuthApi>(
  (ref) => AuthApi(ref.watch(dioProvider)),
);
final catalogApiProvider = Provider<CatalogApi>(
  (ref) => CatalogApi(ref.watch(dioProvider)),
);
final meApiProvider = Provider<MeApi>((ref) => MeApi(ref.watch(dioProvider)));
final kycApiProvider = Provider<KycApi>(
  (ref) => KycApi(ref.watch(dioProvider)),
);
final bookingApiProvider = Provider<BookingApi>(
  (ref) => BookingApi(ref.watch(dioProvider)),
);

/// "Now". Injected so screens that count down (the payment hold) are testable without waiting.
final clockProvider = Provider<DateTime Function()>((ref) => DateTime.now);

final photoPickerProvider = Provider<PhotoPicker>(
  (ref) => const SystemPhotoPicker(),
);

final locationServiceProvider = Provider<LocationService>(
  (ref) => const GeolocatorLocationService(),
);

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

final routerProvider = Provider<GoRouter>((ref) {
  final changes = ValueNotifier<int>(0);
  ref.listen<AuthState>(authControllerProvider, (_, _) => changes.value++);
  final router = buildRouter(
    refreshListenable: changes,
    authState: () => ref.read(authControllerProvider),
  );
  ref.onDispose(() {
    router.dispose();
    changes.dispose();
  });
  return router;
});
