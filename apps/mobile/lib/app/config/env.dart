/// Build-time configuration, selected with `--dart-define` (README §11.4).
///
/// Nothing secret belongs here: anything compiled into the app can be extracted.
enum Flavor { dev, staging, prod }

/// Thrown when the build configuration is invalid. The message names the offending key but never echoes
/// values that could be sensitive (e.g. a Sentry DSN).
class EnvException implements Exception {
  const EnvException(this.message);

  final String message;

  @override
  String toString() => 'EnvException: $message';
}

class AppEnv {
  const AppEnv({
    required this.flavor,
    required this.apiBaseUrl,
    this.sentryDsn,
  });

  /// Default API for local development: the Android emulator's alias for the host machine's loopback.
  static const String devApiBaseUrl = 'http://10.0.2.2:3000';

  final Flavor flavor;

  /// API origin without a trailing slash.
  final String apiBaseUrl;

  /// Optional crash-reporting DSN (wired up in P4-07).
  final String? sentryDsn;

  bool get isProd => flavor == Flavor.prod;

  /// Reads the compile-time defines: `FLAVOR`, `API_BASE_URL`, `SENTRY_DSN`.
  factory AppEnv.fromDefines() => AppEnv.parse(const {
    'FLAVOR': String.fromEnvironment('FLAVOR'),
    'API_BASE_URL': String.fromEnvironment('API_BASE_URL'),
    'SENTRY_DSN': String.fromEnvironment('SENTRY_DSN'),
  });

  /// Pure validation core (compile-time defines cannot vary inside a test run).
  factory AppEnv.parse(Map<String, String> defines) {
    String? value(String key) {
      final trimmed = defines[key]?.trim();
      return (trimmed == null || trimmed.isEmpty) ? null : trimmed;
    }

    final flavorName = value('FLAVOR') ?? 'dev';
    final flavor = Flavor.values.where((f) => f.name == flavorName).firstOrNull;
    if (flavor == null) {
      throw const EnvException('FLAVOR must be one of: dev, staging, prod.');
    }

    final rawUrl =
        value('API_BASE_URL') ?? (flavor == Flavor.dev ? devApiBaseUrl : null);
    if (rawUrl == null) {
      throw EnvException(
        'API_BASE_URL is required for the "${flavor.name}" flavor.',
      );
    }
    final apiBaseUrl = rawUrl.replaceAll(RegExp(r'/+$'), '');
    final uri = Uri.tryParse(apiBaseUrl);
    final isHttp =
        uri != null && (uri.scheme == 'http' || uri.scheme == 'https');
    if (!isHttp || uri.host.isEmpty) {
      throw const EnvException(
        'API_BASE_URL must be an http(s) URL with a host.',
      );
    }
    if (flavor == Flavor.prod && uri.scheme != 'https') {
      throw const EnvException(
        'API_BASE_URL must use https in the "prod" flavor.',
      );
    }

    return AppEnv(
      flavor: flavor,
      apiBaseUrl: apiBaseUrl,
      sentryDsn: value('SENTRY_DSN'),
    );
  }
}
