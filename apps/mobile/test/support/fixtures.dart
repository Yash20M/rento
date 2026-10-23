// JSON fixtures shaped exactly like the API's answers (see packages/contracts/openapi.json).

Map<String, dynamic> userJson({
  String id = 'u-1',
  String? email = 'asha@example.com',
  String? displayName = 'Asha',
}) => {
  'id': id,
  'email': email,
  'displayName': displayName,
  'emailVerified': true,
  'avatarUrl': null,
};

Map<String, dynamic> authJson({int n = 1, Map<String, dynamic>? user}) => {
  'accessToken': 'access-$n',
  'refreshToken': 'refresh-$n',
  'tokenType': 'Bearer',
  'expiresIn': 900,
  'user': user ?? userJson(),
};

Map<String, dynamic> problemJson(
  int status,
  String code, {
  String detail = 'Problem',
  List<Map<String, String>>? errors,
}) => {
  'type': 'urn:rento:problem:${code.toLowerCase()}',
  'title': 'Problem',
  'status': status,
  'code': code,
  'detail': detail,
  if (errors != null) 'errors': errors,
  'traceId': 'trace-test',
};

Map<String, dynamic> drawerJson({
  String id = 'd-1',
  String name = 'Indiranagar',
  bool openNow = true,
  String timezone = 'Asia/Kolkata',
}) => {
  'id': id,
  'name': name,
  'address': '1 Test Street, Bengaluru',
  'timezone': timezone,
  'latitude': 12.9716,
  'longitude': 77.5946,
  'pickupInstructions': 'Ring the bell at the glass door',
  'photoUrl': null,
  'hours': [
    for (var day = 1; day <= 7; day++)
      {'weekday': day, 'opensAt': '09:00', 'closesAt': '21:00'},
  ],
  'openNow': openNow,
};

Map<String, dynamic> nearbyDrawerJson({
  String id = 'd-1',
  String name = 'Indiranagar',
  int distance = 850,
  bool openNow = true,
  int? availableNow,
  String? reason,
}) => {
  ...drawerJson(id: id, name: name, openNow: openNow),
  'distanceMeters': distance,
  'availableNow': availableNow,
  'reason': reason,
};

Map<String, dynamic> inventoryJson({
  String id = 'm-1',
  String name = 'PlayStation 5',
  int availableNow = 2,
}) => {
  'itemModelId': id,
  'name': name,
  'categoryId': 'cat-1',
  'photos': <String>[],
  'description': null,
  'pricePerSlotPaise': 4900,
  'slotMinutes': 30,
  'minDurationMin': 30,
  'maxDurationMin': 240,
  'depositPaise': 20000,
  'total': 3,
  'availableNow': availableNow,
};

Map<String, dynamic> availabilityJson({
  String date = '2030-01-07',
  List<Map<String, dynamic>>? slots,
  bool open = true,
}) => {
  'drawerId': 'd-1',
  'itemModelId': 'm-1',
  'date': date,
  'timezone': 'Asia/Kolkata',
  'slotMinutes': 30,
  'minDurationMin': 30,
  'maxDurationMin': 240,
  'bufferMin': 15,
  'pricePerSlotPaise': 4900,
  'opensAt': open ? '2030-01-07T03:30:00.000Z' : null,
  'closesAt': open ? '2030-01-07T15:30:00.000Z' : null,
  'slots':
      slots ??
      [
        // 10:00 and 10:30 India time, both with room for 2 hours
        {
          'startsAt': '2030-01-07T04:30:00.000Z',
          'freeAssets': 2,
          'maxFreeMinutes': 120,
        },
        {
          'startsAt': '2030-01-07T05:00:00.000Z',
          'freeAssets': 1,
          'maxFreeMinutes': 60,
        },
        {
          'startsAt': '2030-01-07T05:30:00.000Z',
          'freeAssets': 0,
          'maxFreeMinutes': 0,
        },
      ],
  'snapshot': true,
  'generatedAt': '2030-01-07T03:00:00.000Z',
};

Map<String, dynamic> bookingJson({
  String id = 'b-1',
  String status = 'held',
  String? holdExpiresAt = '2030-01-07T03:10:00.000Z',
  bool cancellable = true,
  Map<String, dynamic>? payment,
  Map<String, dynamic>? refund,
  String startsAt = '2030-01-07T04:30:00.000Z',
  String endsAt = '2030-01-07T05:30:00.000Z',
  String? cancelReason,
}) => {
  'id': id,
  'status': status,
  'drawer': {
    'id': 'd-1',
    'name': 'Indiranagar',
    'address': '1 Test Street, Bengaluru',
    'timezone': 'Asia/Kolkata',
  },
  'itemModel': {'id': 'm-1', 'name': 'PlayStation 5', 'photoUrl': null},
  'assetCode': 'PS5-001',
  'startsAt': startsAt,
  'endsAt': endsAt,
  'durationMinutes': 60,
  'pricePaise': 9800,
  'depositPaise': 20000,
  'totalPaise': 29800,
  'currency': 'INR',
  'holdExpiresAt': holdExpiresAt,
  'cancellable': cancellable,
  'cancelReason': cancelReason,
  'payment': payment,
  'refund': refund,
  'createdAt': '2030-01-07T03:00:00.000Z',
};

Map<String, dynamic> paidJson() => {
  'status': 'captured',
  'orderId': 'order-1',
  'amountPaise': 29800,
};
