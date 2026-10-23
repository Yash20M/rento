// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'catalog.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_OpeningHours _$OpeningHoursFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_OpeningHours', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['weekday', 'opensAt', 'closesAt']);
      final val = _OpeningHours(
        weekday: $checkedConvert('weekday', (v) => (v as num).toInt()),
        opensAt: $checkedConvert('opensAt', (v) => v as String),
        closesAt: $checkedConvert('closesAt', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$OpeningHoursToJson(_OpeningHours instance) =>
    <String, dynamic>{
      'weekday': instance.weekday,
      'opensAt': instance.opensAt,
      'closesAt': instance.closesAt,
    };

_PublicDrawer _$PublicDrawerFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_PublicDrawer', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'name',
          'address',
          'timezone',
          'latitude',
          'longitude',
          'pickupInstructions',
          'photoUrl',
          'hours',
          'openNow',
        ],
      );
      final val = _PublicDrawer(
        id: $checkedConvert('id', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        address: $checkedConvert('address', (v) => v as String),
        timezone: $checkedConvert('timezone', (v) => v as String),
        latitude: $checkedConvert('latitude', (v) => (v as num).toDouble()),
        longitude: $checkedConvert('longitude', (v) => (v as num).toDouble()),
        pickupInstructions: $checkedConvert(
          'pickupInstructions',
          (v) => v as String?,
        ),
        photoUrl: $checkedConvert('photoUrl', (v) => v as String?),
        hours: $checkedConvert(
          'hours',
          (v) =>
              (v as List<dynamic>)
                  .map((e) => OpeningHours.fromJson(e as Map<String, dynamic>))
                  .toList(),
        ),
        openNow: $checkedConvert('openNow', (v) => v as bool),
      );
      return val;
    });

Map<String, dynamic> _$PublicDrawerToJson(_PublicDrawer instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'address': instance.address,
      'timezone': instance.timezone,
      'latitude': instance.latitude,
      'longitude': instance.longitude,
      'pickupInstructions': instance.pickupInstructions,
      'photoUrl': instance.photoUrl,
      'hours': instance.hours.map((e) => e.toJson()).toList(),
      'openNow': instance.openNow,
    };

_NearbyRequest _$NearbyRequestFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_NearbyRequest', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['latitude', 'longitude']);
      final val = _NearbyRequest(
        latitude: $checkedConvert('latitude', (v) => (v as num).toDouble()),
        longitude: $checkedConvert('longitude', (v) => (v as num).toDouble()),
        itemModelId: $checkedConvert('itemModelId', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$NearbyRequestToJson(_NearbyRequest instance) =>
    <String, dynamic>{
      'latitude': instance.latitude,
      'longitude': instance.longitude,
      if (instance.itemModelId case final value?) 'itemModelId': value,
    };

_NearbyDrawer _$NearbyDrawerFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_NearbyDrawer', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'name',
          'address',
          'timezone',
          'latitude',
          'longitude',
          'pickupInstructions',
          'photoUrl',
          'hours',
          'openNow',
          'distanceMeters',
          'availableNow',
          'reason',
        ],
      );
      final val = _NearbyDrawer(
        id: $checkedConvert('id', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        address: $checkedConvert('address', (v) => v as String),
        timezone: $checkedConvert('timezone', (v) => v as String),
        latitude: $checkedConvert('latitude', (v) => (v as num).toDouble()),
        longitude: $checkedConvert('longitude', (v) => (v as num).toDouble()),
        pickupInstructions: $checkedConvert(
          'pickupInstructions',
          (v) => v as String?,
        ),
        photoUrl: $checkedConvert('photoUrl', (v) => v as String?),
        hours: $checkedConvert(
          'hours',
          (v) =>
              (v as List<dynamic>)
                  .map((e) => OpeningHours.fromJson(e as Map<String, dynamic>))
                  .toList(),
        ),
        openNow: $checkedConvert('openNow', (v) => v as bool),
        distanceMeters: $checkedConvert(
          'distanceMeters',
          (v) => (v as num).toInt(),
        ),
        availableNow: $checkedConvert(
          'availableNow',
          (v) => (v as num?)?.toInt(),
        ),
        reason: $checkedConvert('reason', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$NearbyDrawerToJson(_NearbyDrawer instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'address': instance.address,
      'timezone': instance.timezone,
      'latitude': instance.latitude,
      'longitude': instance.longitude,
      'pickupInstructions': instance.pickupInstructions,
      'photoUrl': instance.photoUrl,
      'hours': instance.hours.map((e) => e.toJson()).toList(),
      'openNow': instance.openNow,
      'distanceMeters': instance.distanceMeters,
      'availableNow': instance.availableNow,
      'reason': instance.reason,
    };

_NearbyResponse _$NearbyResponseFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_NearbyResponse', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['drawers', 'unavailable']);
      final val = _NearbyResponse(
        drawers: $checkedConvert(
          'drawers',
          (v) =>
              (v as List<dynamic>)
                  .map((e) => NearbyDrawer.fromJson(e as Map<String, dynamic>))
                  .toList(),
        ),
        unavailable: $checkedConvert(
          'unavailable',
          (v) =>
              (v as List<dynamic>)
                  .map((e) => NearbyDrawer.fromJson(e as Map<String, dynamic>))
                  .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$NearbyResponseToJson(_NearbyResponse instance) =>
    <String, dynamic>{
      'drawers': instance.drawers.map((e) => e.toJson()).toList(),
      'unavailable': instance.unavailable.map((e) => e.toJson()).toList(),
    };

_InventoryEntry _$InventoryEntryFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('_InventoryEntry', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'itemModelId',
      'name',
      'categoryId',
      'photos',
      'description',
      'pricePerSlotPaise',
      'slotMinutes',
      'minDurationMin',
      'maxDurationMin',
      'depositPaise',
      'total',
      'availableNow',
    ],
  );
  final val = _InventoryEntry(
    itemModelId: $checkedConvert('itemModelId', (v) => v as String),
    name: $checkedConvert('name', (v) => v as String),
    categoryId: $checkedConvert('categoryId', (v) => v as String),
    photos: $checkedConvert(
      'photos',
      (v) => (v as List<dynamic>).map((e) => e as String).toList(),
    ),
    description: $checkedConvert('description', (v) => v as String?),
    pricePerSlotPaise: $checkedConvert(
      'pricePerSlotPaise',
      (v) => (v as num).toInt(),
    ),
    slotMinutes: $checkedConvert('slotMinutes', (v) => (v as num).toInt()),
    minDurationMin: $checkedConvert(
      'minDurationMin',
      (v) => (v as num).toInt(),
    ),
    maxDurationMin: $checkedConvert(
      'maxDurationMin',
      (v) => (v as num).toInt(),
    ),
    depositPaise: $checkedConvert('depositPaise', (v) => (v as num).toInt()),
    total: $checkedConvert('total', (v) => (v as num).toInt()),
    availableNow: $checkedConvert('availableNow', (v) => (v as num).toInt()),
  );
  return val;
});

Map<String, dynamic> _$InventoryEntryToJson(_InventoryEntry instance) =>
    <String, dynamic>{
      'itemModelId': instance.itemModelId,
      'name': instance.name,
      'categoryId': instance.categoryId,
      'photos': instance.photos,
      'description': instance.description,
      'pricePerSlotPaise': instance.pricePerSlotPaise,
      'slotMinutes': instance.slotMinutes,
      'minDurationMin': instance.minDurationMin,
      'maxDurationMin': instance.maxDurationMin,
      'depositPaise': instance.depositPaise,
      'total': instance.total,
      'availableNow': instance.availableNow,
    };

_AvailabilitySlot _$AvailabilitySlotFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_AvailabilitySlot', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['startsAt', 'freeAssets', 'maxFreeMinutes'],
      );
      final val = _AvailabilitySlot(
        startsAt: $checkedConvert(
          'startsAt',
          (v) => DateTime.parse(v as String),
        ),
        freeAssets: $checkedConvert('freeAssets', (v) => (v as num).toInt()),
        maxFreeMinutes: $checkedConvert(
          'maxFreeMinutes',
          (v) => (v as num).toInt(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$AvailabilitySlotToJson(_AvailabilitySlot instance) =>
    <String, dynamic>{
      'startsAt': instance.startsAt.toIso8601String(),
      'freeAssets': instance.freeAssets,
      'maxFreeMinutes': instance.maxFreeMinutes,
    };

_Availability _$AvailabilityFromJson(Map<String, dynamic> json) =>
    $checkedCreate('_Availability', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'drawerId',
          'itemModelId',
          'date',
          'timezone',
          'slotMinutes',
          'minDurationMin',
          'maxDurationMin',
          'bufferMin',
          'pricePerSlotPaise',
          'opensAt',
          'closesAt',
          'slots',
          'snapshot',
          'generatedAt',
        ],
      );
      final val = _Availability(
        drawerId: $checkedConvert('drawerId', (v) => v as String),
        itemModelId: $checkedConvert('itemModelId', (v) => v as String),
        date: $checkedConvert('date', (v) => v as String),
        timezone: $checkedConvert('timezone', (v) => v as String),
        slotMinutes: $checkedConvert('slotMinutes', (v) => (v as num).toInt()),
        minDurationMin: $checkedConvert(
          'minDurationMin',
          (v) => (v as num).toInt(),
        ),
        maxDurationMin: $checkedConvert(
          'maxDurationMin',
          (v) => (v as num).toInt(),
        ),
        bufferMin: $checkedConvert('bufferMin', (v) => (v as num).toInt()),
        pricePerSlotPaise: $checkedConvert(
          'pricePerSlotPaise',
          (v) => (v as num).toInt(),
        ),
        opensAt: $checkedConvert(
          'opensAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        closesAt: $checkedConvert(
          'closesAt',
          (v) => v == null ? null : DateTime.parse(v as String),
        ),
        slots: $checkedConvert(
          'slots',
          (v) =>
              (v as List<dynamic>)
                  .map(
                    (e) => AvailabilitySlot.fromJson(e as Map<String, dynamic>),
                  )
                  .toList(),
        ),
        snapshot: $checkedConvert('snapshot', (v) => v as bool),
        generatedAt: $checkedConvert(
          'generatedAt',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$AvailabilityToJson(_Availability instance) =>
    <String, dynamic>{
      'drawerId': instance.drawerId,
      'itemModelId': instance.itemModelId,
      'date': instance.date,
      'timezone': instance.timezone,
      'slotMinutes': instance.slotMinutes,
      'minDurationMin': instance.minDurationMin,
      'maxDurationMin': instance.maxDurationMin,
      'bufferMin': instance.bufferMin,
      'pricePerSlotPaise': instance.pricePerSlotPaise,
      'opensAt': instance.opensAt?.toIso8601String(),
      'closesAt': instance.closesAt?.toIso8601String(),
      'slots': instance.slots.map((e) => e.toJson()).toList(),
      'snapshot': instance.snapshot,
      'generatedAt': instance.generatedAt.toIso8601String(),
    };
