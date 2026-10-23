import 'dart:convert';

import 'package:dio/dio.dart';

import '../net/connectivity.dart';
import '../storage/secure_store.dart';

/// The last good answer of the few screens that are useful offline (README §11.4): the drawer list and the customer's
/// bookings. READ-ONLY: nothing is ever written back and nothing can be booked offline. The copy is the exact JSON the
/// server sent, kept in the platform's secure storage, and is wiped when the session ends (the bookings are personal).
class ReadCache {
  ReadCache(this._store);

  static const _keys = {
    '/v1/drawers': 'cache.drawers',
    '/v1/bookings': 'cache.bookings',
  };

  final SecureStore _store;

  static String? keyFor(RequestOptions options) =>
      options.method == 'GET' ? _keys[options.path] : null;

  Future<void> save(String key, Object? json) =>
      _store.write(key, jsonEncode(json));

  Future<Object?> load(String key) async {
    final raw = await _store.read(key);
    if (raw == null) return null;
    try {
      return jsonDecode(raw);
    } on FormatException {
      return null;
    }
  }

  /// Forgets everything saved (sign-out, account deletion, a refused session).
  Future<void> clear() async {
    for (final key in _keys.values) {
      await _store.delete(key);
    }
  }
}

/// Saves successful answers and, when the server cannot be reached, serves the saved one (marked `fromCache`).
class CacheInterceptor extends Interceptor {
  CacheInterceptor(this.cache);

  final ReadCache cache;

  @override
  Future<void> onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) async {
    final key = ReadCache.keyFor(response.requestOptions);
    if (key != null &&
        response.statusCode == 200 &&
        response.extra['fromCache'] != true) {
      await cache.save(key, response.data);
    }
    handler.next(response);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final key = ReadCache.keyFor(err.requestOptions);
    if (key != null && isUnreachable(err)) {
      final saved = await cache.load(key);
      if (saved != null) {
        return handler.resolve(
          Response<dynamic>(
            requestOptions: err.requestOptions,
            statusCode: 200,
            data: saved,
            extra: {'fromCache': true},
          ),
        );
      }
    }
    handler.next(err);
  }
}
