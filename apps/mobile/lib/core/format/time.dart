import 'package:intl/intl.dart';
import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

bool _loaded = false;

/// Loads the time-zone database once. Dart has no built-in IANA zones, and a drawer's opening hours and slot times
/// must be shown in the DRAWER'S zone, not the phone's (README §3.2).
void ensureTimeZones() {
  if (_loaded) return;
  tzdata.initializeTimeZones();
  _loaded = true;
}

tz.Location _location(String zone) {
  ensureTimeZones();
  try {
    return tz.getLocation(zone);
  } catch (_) {
    return tz.UTC;
  }
}

/// The instant seen on the wall clock of [zone].
tz.TZDateTime inZone(DateTime instant, String zone) =>
    tz.TZDateTime.from(instant.toUtc(), _location(zone));

/// `10:30 AM` in [zone].
String formatTimeOfDay(DateTime instant, String zone) =>
    DateFormat('h:mm a').format(inZone(instant, zone));

/// `Mon, 7 Jan` in [zone].
String formatDayLabel(DateTime instant, String zone) =>
    DateFormat('EEE, d MMM').format(inZone(instant, zone));

/// `Mon, 7 Jan · 10:30 AM` in [zone].
String formatDateTime(DateTime instant, String zone) =>
    '${formatDayLabel(instant, zone)} · ${formatTimeOfDay(instant, zone)}';

/// `YYYY-MM-DD` of the instant on [zone]'s calendar — the `date` the availability endpoint wants.
String localDate(DateTime instant, String zone) =>
    DateFormat('yyyy-MM-dd').format(inZone(instant, zone));

/// The next [count] calendar days starting today in [zone], as `YYYY-MM-DD` with a label.
List<({String date, String label})> upcomingDays(
  DateTime now,
  String zone, {
  int count = 7,
}) {
  final today = inZone(now, zone);
  return [
    for (var i = 0; i < count; i++)
      (
        date: DateFormat('yyyy-MM-dd').format(
          tz.TZDateTime(today.location, today.year, today.month, today.day + i),
        ),
        label: DateFormat('EEE d').format(
          tz.TZDateTime(today.location, today.year, today.month, today.day + i),
        ),
      ),
  ];
}
