import 'dart:math';

final Random _secure = Random.secure();

/// A random (version 4) UUID, used as the `Idempotency-Key` of one booking attempt.
String newUuid([Random? random]) {
  final r = random ?? _secure;
  final bytes = List<int>.generate(16, (_) => r.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  String hex(int from, int to) =>
      bytes
          .sublist(from, to)
          .map((b) => b.toRadixString(16).padLeft(2, '0'))
          .join();
  return '${hex(0, 4)}-${hex(4, 6)}-${hex(6, 8)}-${hex(8, 10)}-${hex(10, 16)}';
}
