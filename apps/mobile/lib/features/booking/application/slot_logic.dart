/// Rental lengths a customer can choose from a start time: multiples of the slot length, at least the model's minimum
/// and at most the smaller of the model's maximum and what some unit can still do from that start.
List<int> durationsFor({
  required int slotMinutes,
  required int minDurationMin,
  required int maxDurationMin,
  required int maxFreeMinutes,
}) {
  if (slotMinutes <= 0) return const [];
  final longest =
      maxDurationMin < maxFreeMinutes ? maxDurationMin : maxFreeMinutes;
  final result = <int>[];
  // Start at the first multiple of the slot that is >= the minimum.
  var length =
      ((minDurationMin + slotMinutes - 1) ~/ slotMinutes) * slotMinutes;
  while (length <= longest) {
    result.add(length);
    length += slotMinutes;
  }
  return result;
}

/// Rental price in paise: whole slots times the slot price (integer arithmetic only).
int rentalPaise({
  required int minutes,
  required int slotMinutes,
  required int pricePerSlotPaise,
}) => (minutes ~/ slotMinutes) * pricePerSlotPaise;
