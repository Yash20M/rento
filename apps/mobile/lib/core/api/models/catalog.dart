import 'package:freezed_annotation/freezed_annotation.dart';

part 'catalog.freezed.dart';
part 'catalog.g.dart';

/// One day's opening window, in the drawer's own time zone (`HoursDto`).
@freezed
abstract class OpeningHours with _$OpeningHours {
  const factory OpeningHours({
    /// ISO weekday: 1 = Monday … 7 = Sunday.
    @JsonKey(required: true) required int weekday,

    /// `HH:MM`, drawer-local.
    @JsonKey(required: true) required String opensAt,
    @JsonKey(required: true) required String closesAt,
  }) = _OpeningHours;

  factory OpeningHours.fromJson(Map<String, dynamic> json) =>
      _$OpeningHoursFromJson(json);
}

/// A drawer as customers see it (`PublicDrawerDto`).
@freezed
abstract class PublicDrawer with _$PublicDrawer {
  const factory PublicDrawer({
    @JsonKey(required: true) required String id,
    @JsonKey(required: true) required String name,
    @JsonKey(required: true) required String address,

    /// IANA zone, e.g. `Asia/Kolkata`.
    @JsonKey(required: true) required String timezone,
    @JsonKey(required: true) required double latitude,
    @JsonKey(required: true) required double longitude,
    @JsonKey(required: true) required String? pickupInstructions,

    /// Cover photo: a path on the API (`/v1/media/<id>`), or null.
    @JsonKey(required: true) required String? photoUrl,
    @JsonKey(required: true) required List<OpeningHours> hours,
    @JsonKey(required: true) required bool openNow,
  }) = _PublicDrawer;

  factory PublicDrawer.fromJson(Map<String, dynamic> json) =>
      _$PublicDrawerFromJson(json);
}

/// `POST /v1/drawers/nearby` body. The coordinates are used for this one search only (never stored or logged).
@freezed
abstract class NearbyRequest with _$NearbyRequest {
  const factory NearbyRequest({
    @JsonKey(required: true) required double latitude,
    @JsonKey(required: true) required double longitude,

    /// Only suggest drawers that have a free unit of this model.
    @JsonKey(includeIfNull: false) String? itemModelId,
  }) = _NearbyRequest;

  factory NearbyRequest.fromJson(Map<String, dynamic> json) =>
      _$NearbyRequestFromJson(json);
}

/// A drawer in a nearby search (`NearbyDrawerDto`).
@freezed
abstract class NearbyDrawer with _$NearbyDrawer {
  const factory NearbyDrawer({
    @JsonKey(required: true) required String id,
    @JsonKey(required: true) required String name,
    @JsonKey(required: true) required String address,
    @JsonKey(required: true) required String timezone,
    @JsonKey(required: true) required double latitude,
    @JsonKey(required: true) required double longitude,
    @JsonKey(required: true) required String? pickupInstructions,

    /// Cover photo: a path on the API (`/v1/media/<id>`), or null.
    @JsonKey(required: true) required String? photoUrl,
    @JsonKey(required: true) required List<OpeningHours> hours,
    @JsonKey(required: true) required bool openNow,

    /// Straight-line distance in meters.
    @JsonKey(required: true) required int distanceMeters,

    /// Free units of the requested model right now (only when a model was given).
    @JsonKey(required: true) required int? availableNow,

    /// `closed` or `out_of_stock` for drawers that are close but cannot serve the request; else null.
    @JsonKey(required: true) required String? reason,
  }) = _NearbyDrawer;

  factory NearbyDrawer.fromJson(Map<String, dynamic> json) =>
      _$NearbyDrawerFromJson(json);
}

@freezed
abstract class NearbyResponse with _$NearbyResponse {
  const factory NearbyResponse({
    /// Open drawers (with stock when a model was given), nearest first.
    @JsonKey(required: true) required List<NearbyDrawer> drawers,

    /// Close by but closed or out of stock — shown so the app can explain.
    @JsonKey(required: true) required List<NearbyDrawer> unavailable,
  }) = _NearbyResponse;

  factory NearbyResponse.fromJson(Map<String, dynamic> json) =>
      _$NearbyResponseFromJson(json);
}

/// What a drawer offers (`InventoryEntryDto`). A snapshot.
@freezed
abstract class InventoryEntry with _$InventoryEntry {
  const factory InventoryEntry({
    @JsonKey(required: true) required String itemModelId,
    @JsonKey(required: true) required String name,
    @JsonKey(required: true) required String categoryId,
    @JsonKey(required: true) required List<String> photos,
    @JsonKey(required: true) required String? description,

    /// What one slot costs right now: the offer price while an offer is active, else the normal price.
    @JsonKey(required: true) required int pricePerSlotPaise,

    /// The normal price of one slot (before any offer).
    @JsonKey(required: true) required int originalPricePerSlotPaise,

    /// Percent off while an offer is active, else `null`.
    @JsonKey(required: true) required int? discountPercent,

    /// When the active offer ends; `null` when there is no offer or it has no end.
    @JsonKey(required: true) required DateTime? discountEndsAt,

    /// Added within the last 14 days.
    @JsonKey(required: true) required bool isNew,

    /// Marked by the staff to be featured on the home screen.
    @JsonKey(required: true) required bool featured,
    @JsonKey(required: true) required DateTime createdAt,
    @JsonKey(required: true) required int slotMinutes,
    @JsonKey(required: true) required int minDurationMin,
    @JsonKey(required: true) required int maxDurationMin,
    @JsonKey(required: true) required int depositPaise,
    @JsonKey(required: true) required int total,
    @JsonKey(required: true) required int availableNow,
  }) = _InventoryEntry;

  factory InventoryEntry.fromJson(Map<String, dynamic> json) =>
      _$InventoryEntryFromJson(json);
}

/// One possible start time (`SlotDto`).
@freezed
abstract class AvailabilitySlot with _$AvailabilitySlot {
  const factory AvailabilitySlot({
    @JsonKey(required: true) required DateTime startsAt,

    /// Units that could be rented from this start for at least the minimum duration.
    @JsonKey(required: true) required int freeAssets,

    /// The longest rental, in minutes, that some unit can do from this start.
    @JsonKey(required: true) required int maxFreeMinutes,
  }) = _AvailabilitySlot;

  factory AvailabilitySlot.fromJson(Map<String, dynamic> json) =>
      _$AvailabilitySlotFromJson(json);
}

/// The slot grid of one local day (`AvailabilityDto`). **A snapshot**: the booking request decides.
@freezed
abstract class Availability with _$Availability {
  const factory Availability({
    @JsonKey(required: true) required String drawerId,
    @JsonKey(required: true) required String itemModelId,

    /// The calendar day in the drawer's time zone, `YYYY-MM-DD`.
    @JsonKey(required: true) required String date,
    @JsonKey(required: true) required String timezone,
    @JsonKey(required: true) required int slotMinutes,
    @JsonKey(required: true) required int minDurationMin,
    @JsonKey(required: true) required int maxDurationMin,
    @JsonKey(required: true) required int bufferMin,

    /// What one slot costs right now (the offer price while an offer is active).
    @JsonKey(required: true) required int pricePerSlotPaise,
    @JsonKey(required: true) required int originalPricePerSlotPaise,
    @JsonKey(required: true) required int? discountPercent,
    @JsonKey(required: true) required DateTime? opensAt,
    @JsonKey(required: true) required DateTime? closesAt,
    @JsonKey(required: true) required List<AvailabilitySlot> slots,
    @JsonKey(required: true) required bool snapshot,
    @JsonKey(required: true) required DateTime generatedAt,
  }) = _Availability;

  factory Availability.fromJson(Map<String, dynamic> json) =>
      _$AvailabilityFromJson(json);
}

/// A banner of the home screen, set up by staff (`PublicPromotionDto`). Only live banners are ever sent.
@freezed
abstract class PublicPromotion with _$PublicPromotion {
  const factory PublicPromotion({
    @JsonKey(required: true) required String id,
    @JsonKey(required: true) required String title,
    @JsonKey(required: true) required String? subtitle,

    /// Label of the banner's button, e.g. "Shop now".
    @JsonKey(required: true) required String? ctaLabel,

    /// `orange`, `ink`, `teal` or `plum`: the colour when there is no picture.
    @JsonKey(required: true) required String theme,

    /// A `/v1/media/<id>` path on the API, or `null`.
    @JsonKey(required: true) required String? imageUrl,

    /// The product the banner opens, or `null` for a plain announcement.
    @JsonKey(required: true) required String? itemModelId,
  }) = _PublicPromotion;

  factory PublicPromotion.fromJson(Map<String, dynamic> json) =>
      _$PublicPromotionFromJson(json);
}
