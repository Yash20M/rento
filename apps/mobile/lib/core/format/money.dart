import 'package:intl/intl.dart';

final NumberFormat _whole = NumberFormat.currency(
  locale: 'en_IN',
  symbol: '₹',
  decimalDigits: 0,
);
final NumberFormat _fraction = NumberFormat.currency(
  locale: 'en_IN',
  symbol: '₹',
  decimalDigits: 2,
);

/// Integer paise → `₹1,234` (whole rupees) or `₹1,234.50`. Money is never a float inside the app; this is display only.
String formatPaise(int paise) =>
    paise % 100 == 0
        ? _whole.format(paise ~/ 100)
        : _fraction.format(paise / 100);
