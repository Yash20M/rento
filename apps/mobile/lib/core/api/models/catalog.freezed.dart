// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'catalog.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$OpeningHours {

/// ISO weekday: 1 = Monday … 7 = Sunday.
@JsonKey(required: true) int get weekday;/// `HH:MM`, drawer-local.
@JsonKey(required: true) String get opensAt;@JsonKey(required: true) String get closesAt;
/// Create a copy of OpeningHours
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$OpeningHoursCopyWith<OpeningHours> get copyWith => _$OpeningHoursCopyWithImpl<OpeningHours>(this as OpeningHours, _$identity);

  /// Serializes this OpeningHours to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is OpeningHours&&(identical(other.weekday, weekday) || other.weekday == weekday)&&(identical(other.opensAt, opensAt) || other.opensAt == opensAt)&&(identical(other.closesAt, closesAt) || other.closesAt == closesAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,weekday,opensAt,closesAt);

@override
String toString() {
  return 'OpeningHours(weekday: $weekday, opensAt: $opensAt, closesAt: $closesAt)';
}


}

/// @nodoc
abstract mixin class $OpeningHoursCopyWith<$Res>  {
  factory $OpeningHoursCopyWith(OpeningHours value, $Res Function(OpeningHours) _then) = _$OpeningHoursCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) int weekday,@JsonKey(required: true) String opensAt,@JsonKey(required: true) String closesAt
});




}
/// @nodoc
class _$OpeningHoursCopyWithImpl<$Res>
    implements $OpeningHoursCopyWith<$Res> {
  _$OpeningHoursCopyWithImpl(this._self, this._then);

  final OpeningHours _self;
  final $Res Function(OpeningHours) _then;

/// Create a copy of OpeningHours
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? weekday = null,Object? opensAt = null,Object? closesAt = null,}) {
  return _then(_self.copyWith(
weekday: null == weekday ? _self.weekday : weekday // ignore: cast_nullable_to_non_nullable
as int,opensAt: null == opensAt ? _self.opensAt : opensAt // ignore: cast_nullable_to_non_nullable
as String,closesAt: null == closesAt ? _self.closesAt : closesAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [OpeningHours].
extension OpeningHoursPatterns on OpeningHours {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _OpeningHours value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _OpeningHours() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _OpeningHours value)  $default,){
final _that = this;
switch (_that) {
case _OpeningHours():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _OpeningHours value)?  $default,){
final _that = this;
switch (_that) {
case _OpeningHours() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  int weekday, @JsonKey(required: true)  String opensAt, @JsonKey(required: true)  String closesAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _OpeningHours() when $default != null:
return $default(_that.weekday,_that.opensAt,_that.closesAt);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  int weekday, @JsonKey(required: true)  String opensAt, @JsonKey(required: true)  String closesAt)  $default,) {final _that = this;
switch (_that) {
case _OpeningHours():
return $default(_that.weekday,_that.opensAt,_that.closesAt);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  int weekday, @JsonKey(required: true)  String opensAt, @JsonKey(required: true)  String closesAt)?  $default,) {final _that = this;
switch (_that) {
case _OpeningHours() when $default != null:
return $default(_that.weekday,_that.opensAt,_that.closesAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _OpeningHours implements OpeningHours {
  const _OpeningHours({@JsonKey(required: true) required this.weekday, @JsonKey(required: true) required this.opensAt, @JsonKey(required: true) required this.closesAt});
  factory _OpeningHours.fromJson(Map<String, dynamic> json) => _$OpeningHoursFromJson(json);

/// ISO weekday: 1 = Monday … 7 = Sunday.
@override@JsonKey(required: true) final  int weekday;
/// `HH:MM`, drawer-local.
@override@JsonKey(required: true) final  String opensAt;
@override@JsonKey(required: true) final  String closesAt;

/// Create a copy of OpeningHours
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$OpeningHoursCopyWith<_OpeningHours> get copyWith => __$OpeningHoursCopyWithImpl<_OpeningHours>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$OpeningHoursToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _OpeningHours&&(identical(other.weekday, weekday) || other.weekday == weekday)&&(identical(other.opensAt, opensAt) || other.opensAt == opensAt)&&(identical(other.closesAt, closesAt) || other.closesAt == closesAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,weekday,opensAt,closesAt);

@override
String toString() {
  return 'OpeningHours(weekday: $weekday, opensAt: $opensAt, closesAt: $closesAt)';
}


}

/// @nodoc
abstract mixin class _$OpeningHoursCopyWith<$Res> implements $OpeningHoursCopyWith<$Res> {
  factory _$OpeningHoursCopyWith(_OpeningHours value, $Res Function(_OpeningHours) _then) = __$OpeningHoursCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) int weekday,@JsonKey(required: true) String opensAt,@JsonKey(required: true) String closesAt
});




}
/// @nodoc
class __$OpeningHoursCopyWithImpl<$Res>
    implements _$OpeningHoursCopyWith<$Res> {
  __$OpeningHoursCopyWithImpl(this._self, this._then);

  final _OpeningHours _self;
  final $Res Function(_OpeningHours) _then;

/// Create a copy of OpeningHours
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? weekday = null,Object? opensAt = null,Object? closesAt = null,}) {
  return _then(_OpeningHours(
weekday: null == weekday ? _self.weekday : weekday // ignore: cast_nullable_to_non_nullable
as int,opensAt: null == opensAt ? _self.opensAt : opensAt // ignore: cast_nullable_to_non_nullable
as String,closesAt: null == closesAt ? _self.closesAt : closesAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$PublicDrawer {

@JsonKey(required: true) String get id;@JsonKey(required: true) String get name;@JsonKey(required: true) String get address;/// IANA zone, e.g. `Asia/Kolkata`.
@JsonKey(required: true) String get timezone;@JsonKey(required: true) double get latitude;@JsonKey(required: true) double get longitude;@JsonKey(required: true) String? get pickupInstructions;/// Cover photo: a path on the API (`/v1/media/<id>`), or null.
@JsonKey(required: true) String? get photoUrl;@JsonKey(required: true) List<OpeningHours> get hours;@JsonKey(required: true) bool get openNow;
/// Create a copy of PublicDrawer
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PublicDrawerCopyWith<PublicDrawer> get copyWith => _$PublicDrawerCopyWithImpl<PublicDrawer>(this as PublicDrawer, _$identity);

  /// Serializes this PublicDrawer to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PublicDrawer&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.address, address) || other.address == address)&&(identical(other.timezone, timezone) || other.timezone == timezone)&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.pickupInstructions, pickupInstructions) || other.pickupInstructions == pickupInstructions)&&(identical(other.photoUrl, photoUrl) || other.photoUrl == photoUrl)&&const DeepCollectionEquality().equals(other.hours, hours)&&(identical(other.openNow, openNow) || other.openNow == openNow));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,address,timezone,latitude,longitude,pickupInstructions,photoUrl,const DeepCollectionEquality().hash(hours),openNow);

@override
String toString() {
  return 'PublicDrawer(id: $id, name: $name, address: $address, timezone: $timezone, latitude: $latitude, longitude: $longitude, pickupInstructions: $pickupInstructions, photoUrl: $photoUrl, hours: $hours, openNow: $openNow)';
}


}

/// @nodoc
abstract mixin class $PublicDrawerCopyWith<$Res>  {
  factory $PublicDrawerCopyWith(PublicDrawer value, $Res Function(PublicDrawer) _then) = _$PublicDrawerCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String id,@JsonKey(required: true) String name,@JsonKey(required: true) String address,@JsonKey(required: true) String timezone,@JsonKey(required: true) double latitude,@JsonKey(required: true) double longitude,@JsonKey(required: true) String? pickupInstructions,@JsonKey(required: true) String? photoUrl,@JsonKey(required: true) List<OpeningHours> hours,@JsonKey(required: true) bool openNow
});




}
/// @nodoc
class _$PublicDrawerCopyWithImpl<$Res>
    implements $PublicDrawerCopyWith<$Res> {
  _$PublicDrawerCopyWithImpl(this._self, this._then);

  final PublicDrawer _self;
  final $Res Function(PublicDrawer) _then;

/// Create a copy of PublicDrawer
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? address = null,Object? timezone = null,Object? latitude = null,Object? longitude = null,Object? pickupInstructions = freezed,Object? photoUrl = freezed,Object? hours = null,Object? openNow = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,address: null == address ? _self.address : address // ignore: cast_nullable_to_non_nullable
as String,timezone: null == timezone ? _self.timezone : timezone // ignore: cast_nullable_to_non_nullable
as String,latitude: null == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double,longitude: null == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double,pickupInstructions: freezed == pickupInstructions ? _self.pickupInstructions : pickupInstructions // ignore: cast_nullable_to_non_nullable
as String?,photoUrl: freezed == photoUrl ? _self.photoUrl : photoUrl // ignore: cast_nullable_to_non_nullable
as String?,hours: null == hours ? _self.hours : hours // ignore: cast_nullable_to_non_nullable
as List<OpeningHours>,openNow: null == openNow ? _self.openNow : openNow // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [PublicDrawer].
extension PublicDrawerPatterns on PublicDrawer {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PublicDrawer value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PublicDrawer() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PublicDrawer value)  $default,){
final _that = this;
switch (_that) {
case _PublicDrawer():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PublicDrawer value)?  $default,){
final _that = this;
switch (_that) {
case _PublicDrawer() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String id, @JsonKey(required: true)  String name, @JsonKey(required: true)  String address, @JsonKey(required: true)  String timezone, @JsonKey(required: true)  double latitude, @JsonKey(required: true)  double longitude, @JsonKey(required: true)  String? pickupInstructions, @JsonKey(required: true)  String? photoUrl, @JsonKey(required: true)  List<OpeningHours> hours, @JsonKey(required: true)  bool openNow)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PublicDrawer() when $default != null:
return $default(_that.id,_that.name,_that.address,_that.timezone,_that.latitude,_that.longitude,_that.pickupInstructions,_that.photoUrl,_that.hours,_that.openNow);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String id, @JsonKey(required: true)  String name, @JsonKey(required: true)  String address, @JsonKey(required: true)  String timezone, @JsonKey(required: true)  double latitude, @JsonKey(required: true)  double longitude, @JsonKey(required: true)  String? pickupInstructions, @JsonKey(required: true)  String? photoUrl, @JsonKey(required: true)  List<OpeningHours> hours, @JsonKey(required: true)  bool openNow)  $default,) {final _that = this;
switch (_that) {
case _PublicDrawer():
return $default(_that.id,_that.name,_that.address,_that.timezone,_that.latitude,_that.longitude,_that.pickupInstructions,_that.photoUrl,_that.hours,_that.openNow);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String id, @JsonKey(required: true)  String name, @JsonKey(required: true)  String address, @JsonKey(required: true)  String timezone, @JsonKey(required: true)  double latitude, @JsonKey(required: true)  double longitude, @JsonKey(required: true)  String? pickupInstructions, @JsonKey(required: true)  String? photoUrl, @JsonKey(required: true)  List<OpeningHours> hours, @JsonKey(required: true)  bool openNow)?  $default,) {final _that = this;
switch (_that) {
case _PublicDrawer() when $default != null:
return $default(_that.id,_that.name,_that.address,_that.timezone,_that.latitude,_that.longitude,_that.pickupInstructions,_that.photoUrl,_that.hours,_that.openNow);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PublicDrawer implements PublicDrawer {
  const _PublicDrawer({@JsonKey(required: true) required this.id, @JsonKey(required: true) required this.name, @JsonKey(required: true) required this.address, @JsonKey(required: true) required this.timezone, @JsonKey(required: true) required this.latitude, @JsonKey(required: true) required this.longitude, @JsonKey(required: true) required this.pickupInstructions, @JsonKey(required: true) required this.photoUrl, @JsonKey(required: true) required final  List<OpeningHours> hours, @JsonKey(required: true) required this.openNow}): _hours = hours;
  factory _PublicDrawer.fromJson(Map<String, dynamic> json) => _$PublicDrawerFromJson(json);

@override@JsonKey(required: true) final  String id;
@override@JsonKey(required: true) final  String name;
@override@JsonKey(required: true) final  String address;
/// IANA zone, e.g. `Asia/Kolkata`.
@override@JsonKey(required: true) final  String timezone;
@override@JsonKey(required: true) final  double latitude;
@override@JsonKey(required: true) final  double longitude;
@override@JsonKey(required: true) final  String? pickupInstructions;
/// Cover photo: a path on the API (`/v1/media/<id>`), or null.
@override@JsonKey(required: true) final  String? photoUrl;
 final  List<OpeningHours> _hours;
@override@JsonKey(required: true) List<OpeningHours> get hours {
  if (_hours is EqualUnmodifiableListView) return _hours;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_hours);
}

@override@JsonKey(required: true) final  bool openNow;

/// Create a copy of PublicDrawer
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PublicDrawerCopyWith<_PublicDrawer> get copyWith => __$PublicDrawerCopyWithImpl<_PublicDrawer>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PublicDrawerToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PublicDrawer&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.address, address) || other.address == address)&&(identical(other.timezone, timezone) || other.timezone == timezone)&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.pickupInstructions, pickupInstructions) || other.pickupInstructions == pickupInstructions)&&(identical(other.photoUrl, photoUrl) || other.photoUrl == photoUrl)&&const DeepCollectionEquality().equals(other._hours, _hours)&&(identical(other.openNow, openNow) || other.openNow == openNow));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,address,timezone,latitude,longitude,pickupInstructions,photoUrl,const DeepCollectionEquality().hash(_hours),openNow);

@override
String toString() {
  return 'PublicDrawer(id: $id, name: $name, address: $address, timezone: $timezone, latitude: $latitude, longitude: $longitude, pickupInstructions: $pickupInstructions, photoUrl: $photoUrl, hours: $hours, openNow: $openNow)';
}


}

/// @nodoc
abstract mixin class _$PublicDrawerCopyWith<$Res> implements $PublicDrawerCopyWith<$Res> {
  factory _$PublicDrawerCopyWith(_PublicDrawer value, $Res Function(_PublicDrawer) _then) = __$PublicDrawerCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String id,@JsonKey(required: true) String name,@JsonKey(required: true) String address,@JsonKey(required: true) String timezone,@JsonKey(required: true) double latitude,@JsonKey(required: true) double longitude,@JsonKey(required: true) String? pickupInstructions,@JsonKey(required: true) String? photoUrl,@JsonKey(required: true) List<OpeningHours> hours,@JsonKey(required: true) bool openNow
});




}
/// @nodoc
class __$PublicDrawerCopyWithImpl<$Res>
    implements _$PublicDrawerCopyWith<$Res> {
  __$PublicDrawerCopyWithImpl(this._self, this._then);

  final _PublicDrawer _self;
  final $Res Function(_PublicDrawer) _then;

/// Create a copy of PublicDrawer
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? address = null,Object? timezone = null,Object? latitude = null,Object? longitude = null,Object? pickupInstructions = freezed,Object? photoUrl = freezed,Object? hours = null,Object? openNow = null,}) {
  return _then(_PublicDrawer(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,address: null == address ? _self.address : address // ignore: cast_nullable_to_non_nullable
as String,timezone: null == timezone ? _self.timezone : timezone // ignore: cast_nullable_to_non_nullable
as String,latitude: null == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double,longitude: null == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double,pickupInstructions: freezed == pickupInstructions ? _self.pickupInstructions : pickupInstructions // ignore: cast_nullable_to_non_nullable
as String?,photoUrl: freezed == photoUrl ? _self.photoUrl : photoUrl // ignore: cast_nullable_to_non_nullable
as String?,hours: null == hours ? _self._hours : hours // ignore: cast_nullable_to_non_nullable
as List<OpeningHours>,openNow: null == openNow ? _self.openNow : openNow // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$NearbyRequest {

@JsonKey(required: true) double get latitude;@JsonKey(required: true) double get longitude;/// Only suggest drawers that have a free unit of this model.
@JsonKey(includeIfNull: false) String? get itemModelId;
/// Create a copy of NearbyRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$NearbyRequestCopyWith<NearbyRequest> get copyWith => _$NearbyRequestCopyWithImpl<NearbyRequest>(this as NearbyRequest, _$identity);

  /// Serializes this NearbyRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is NearbyRequest&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.itemModelId, itemModelId) || other.itemModelId == itemModelId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,latitude,longitude,itemModelId);

@override
String toString() {
  return 'NearbyRequest(latitude: $latitude, longitude: $longitude, itemModelId: $itemModelId)';
}


}

/// @nodoc
abstract mixin class $NearbyRequestCopyWith<$Res>  {
  factory $NearbyRequestCopyWith(NearbyRequest value, $Res Function(NearbyRequest) _then) = _$NearbyRequestCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) double latitude,@JsonKey(required: true) double longitude,@JsonKey(includeIfNull: false) String? itemModelId
});




}
/// @nodoc
class _$NearbyRequestCopyWithImpl<$Res>
    implements $NearbyRequestCopyWith<$Res> {
  _$NearbyRequestCopyWithImpl(this._self, this._then);

  final NearbyRequest _self;
  final $Res Function(NearbyRequest) _then;

/// Create a copy of NearbyRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? latitude = null,Object? longitude = null,Object? itemModelId = freezed,}) {
  return _then(_self.copyWith(
latitude: null == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double,longitude: null == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double,itemModelId: freezed == itemModelId ? _self.itemModelId : itemModelId // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [NearbyRequest].
extension NearbyRequestPatterns on NearbyRequest {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _NearbyRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _NearbyRequest() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _NearbyRequest value)  $default,){
final _that = this;
switch (_that) {
case _NearbyRequest():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _NearbyRequest value)?  $default,){
final _that = this;
switch (_that) {
case _NearbyRequest() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  double latitude, @JsonKey(required: true)  double longitude, @JsonKey(includeIfNull: false)  String? itemModelId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _NearbyRequest() when $default != null:
return $default(_that.latitude,_that.longitude,_that.itemModelId);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  double latitude, @JsonKey(required: true)  double longitude, @JsonKey(includeIfNull: false)  String? itemModelId)  $default,) {final _that = this;
switch (_that) {
case _NearbyRequest():
return $default(_that.latitude,_that.longitude,_that.itemModelId);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  double latitude, @JsonKey(required: true)  double longitude, @JsonKey(includeIfNull: false)  String? itemModelId)?  $default,) {final _that = this;
switch (_that) {
case _NearbyRequest() when $default != null:
return $default(_that.latitude,_that.longitude,_that.itemModelId);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _NearbyRequest implements NearbyRequest {
  const _NearbyRequest({@JsonKey(required: true) required this.latitude, @JsonKey(required: true) required this.longitude, @JsonKey(includeIfNull: false) this.itemModelId});
  factory _NearbyRequest.fromJson(Map<String, dynamic> json) => _$NearbyRequestFromJson(json);

@override@JsonKey(required: true) final  double latitude;
@override@JsonKey(required: true) final  double longitude;
/// Only suggest drawers that have a free unit of this model.
@override@JsonKey(includeIfNull: false) final  String? itemModelId;

/// Create a copy of NearbyRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$NearbyRequestCopyWith<_NearbyRequest> get copyWith => __$NearbyRequestCopyWithImpl<_NearbyRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$NearbyRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _NearbyRequest&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.itemModelId, itemModelId) || other.itemModelId == itemModelId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,latitude,longitude,itemModelId);

@override
String toString() {
  return 'NearbyRequest(latitude: $latitude, longitude: $longitude, itemModelId: $itemModelId)';
}


}

/// @nodoc
abstract mixin class _$NearbyRequestCopyWith<$Res> implements $NearbyRequestCopyWith<$Res> {
  factory _$NearbyRequestCopyWith(_NearbyRequest value, $Res Function(_NearbyRequest) _then) = __$NearbyRequestCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) double latitude,@JsonKey(required: true) double longitude,@JsonKey(includeIfNull: false) String? itemModelId
});




}
/// @nodoc
class __$NearbyRequestCopyWithImpl<$Res>
    implements _$NearbyRequestCopyWith<$Res> {
  __$NearbyRequestCopyWithImpl(this._self, this._then);

  final _NearbyRequest _self;
  final $Res Function(_NearbyRequest) _then;

/// Create a copy of NearbyRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? latitude = null,Object? longitude = null,Object? itemModelId = freezed,}) {
  return _then(_NearbyRequest(
latitude: null == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double,longitude: null == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double,itemModelId: freezed == itemModelId ? _self.itemModelId : itemModelId // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$NearbyDrawer {

@JsonKey(required: true) String get id;@JsonKey(required: true) String get name;@JsonKey(required: true) String get address;@JsonKey(required: true) String get timezone;@JsonKey(required: true) double get latitude;@JsonKey(required: true) double get longitude;@JsonKey(required: true) String? get pickupInstructions;/// Cover photo: a path on the API (`/v1/media/<id>`), or null.
@JsonKey(required: true) String? get photoUrl;@JsonKey(required: true) List<OpeningHours> get hours;@JsonKey(required: true) bool get openNow;/// Straight-line distance in meters.
@JsonKey(required: true) int get distanceMeters;/// Free units of the requested model right now (only when a model was given).
@JsonKey(required: true) int? get availableNow;/// `closed` or `out_of_stock` for drawers that are close but cannot serve the request; else null.
@JsonKey(required: true) String? get reason;
/// Create a copy of NearbyDrawer
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$NearbyDrawerCopyWith<NearbyDrawer> get copyWith => _$NearbyDrawerCopyWithImpl<NearbyDrawer>(this as NearbyDrawer, _$identity);

  /// Serializes this NearbyDrawer to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is NearbyDrawer&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.address, address) || other.address == address)&&(identical(other.timezone, timezone) || other.timezone == timezone)&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.pickupInstructions, pickupInstructions) || other.pickupInstructions == pickupInstructions)&&(identical(other.photoUrl, photoUrl) || other.photoUrl == photoUrl)&&const DeepCollectionEquality().equals(other.hours, hours)&&(identical(other.openNow, openNow) || other.openNow == openNow)&&(identical(other.distanceMeters, distanceMeters) || other.distanceMeters == distanceMeters)&&(identical(other.availableNow, availableNow) || other.availableNow == availableNow)&&(identical(other.reason, reason) || other.reason == reason));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,address,timezone,latitude,longitude,pickupInstructions,photoUrl,const DeepCollectionEquality().hash(hours),openNow,distanceMeters,availableNow,reason);

@override
String toString() {
  return 'NearbyDrawer(id: $id, name: $name, address: $address, timezone: $timezone, latitude: $latitude, longitude: $longitude, pickupInstructions: $pickupInstructions, photoUrl: $photoUrl, hours: $hours, openNow: $openNow, distanceMeters: $distanceMeters, availableNow: $availableNow, reason: $reason)';
}


}

/// @nodoc
abstract mixin class $NearbyDrawerCopyWith<$Res>  {
  factory $NearbyDrawerCopyWith(NearbyDrawer value, $Res Function(NearbyDrawer) _then) = _$NearbyDrawerCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String id,@JsonKey(required: true) String name,@JsonKey(required: true) String address,@JsonKey(required: true) String timezone,@JsonKey(required: true) double latitude,@JsonKey(required: true) double longitude,@JsonKey(required: true) String? pickupInstructions,@JsonKey(required: true) String? photoUrl,@JsonKey(required: true) List<OpeningHours> hours,@JsonKey(required: true) bool openNow,@JsonKey(required: true) int distanceMeters,@JsonKey(required: true) int? availableNow,@JsonKey(required: true) String? reason
});




}
/// @nodoc
class _$NearbyDrawerCopyWithImpl<$Res>
    implements $NearbyDrawerCopyWith<$Res> {
  _$NearbyDrawerCopyWithImpl(this._self, this._then);

  final NearbyDrawer _self;
  final $Res Function(NearbyDrawer) _then;

/// Create a copy of NearbyDrawer
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? address = null,Object? timezone = null,Object? latitude = null,Object? longitude = null,Object? pickupInstructions = freezed,Object? photoUrl = freezed,Object? hours = null,Object? openNow = null,Object? distanceMeters = null,Object? availableNow = freezed,Object? reason = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,address: null == address ? _self.address : address // ignore: cast_nullable_to_non_nullable
as String,timezone: null == timezone ? _self.timezone : timezone // ignore: cast_nullable_to_non_nullable
as String,latitude: null == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double,longitude: null == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double,pickupInstructions: freezed == pickupInstructions ? _self.pickupInstructions : pickupInstructions // ignore: cast_nullable_to_non_nullable
as String?,photoUrl: freezed == photoUrl ? _self.photoUrl : photoUrl // ignore: cast_nullable_to_non_nullable
as String?,hours: null == hours ? _self.hours : hours // ignore: cast_nullable_to_non_nullable
as List<OpeningHours>,openNow: null == openNow ? _self.openNow : openNow // ignore: cast_nullable_to_non_nullable
as bool,distanceMeters: null == distanceMeters ? _self.distanceMeters : distanceMeters // ignore: cast_nullable_to_non_nullable
as int,availableNow: freezed == availableNow ? _self.availableNow : availableNow // ignore: cast_nullable_to_non_nullable
as int?,reason: freezed == reason ? _self.reason : reason // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [NearbyDrawer].
extension NearbyDrawerPatterns on NearbyDrawer {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _NearbyDrawer value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _NearbyDrawer() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _NearbyDrawer value)  $default,){
final _that = this;
switch (_that) {
case _NearbyDrawer():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _NearbyDrawer value)?  $default,){
final _that = this;
switch (_that) {
case _NearbyDrawer() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String id, @JsonKey(required: true)  String name, @JsonKey(required: true)  String address, @JsonKey(required: true)  String timezone, @JsonKey(required: true)  double latitude, @JsonKey(required: true)  double longitude, @JsonKey(required: true)  String? pickupInstructions, @JsonKey(required: true)  String? photoUrl, @JsonKey(required: true)  List<OpeningHours> hours, @JsonKey(required: true)  bool openNow, @JsonKey(required: true)  int distanceMeters, @JsonKey(required: true)  int? availableNow, @JsonKey(required: true)  String? reason)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _NearbyDrawer() when $default != null:
return $default(_that.id,_that.name,_that.address,_that.timezone,_that.latitude,_that.longitude,_that.pickupInstructions,_that.photoUrl,_that.hours,_that.openNow,_that.distanceMeters,_that.availableNow,_that.reason);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String id, @JsonKey(required: true)  String name, @JsonKey(required: true)  String address, @JsonKey(required: true)  String timezone, @JsonKey(required: true)  double latitude, @JsonKey(required: true)  double longitude, @JsonKey(required: true)  String? pickupInstructions, @JsonKey(required: true)  String? photoUrl, @JsonKey(required: true)  List<OpeningHours> hours, @JsonKey(required: true)  bool openNow, @JsonKey(required: true)  int distanceMeters, @JsonKey(required: true)  int? availableNow, @JsonKey(required: true)  String? reason)  $default,) {final _that = this;
switch (_that) {
case _NearbyDrawer():
return $default(_that.id,_that.name,_that.address,_that.timezone,_that.latitude,_that.longitude,_that.pickupInstructions,_that.photoUrl,_that.hours,_that.openNow,_that.distanceMeters,_that.availableNow,_that.reason);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String id, @JsonKey(required: true)  String name, @JsonKey(required: true)  String address, @JsonKey(required: true)  String timezone, @JsonKey(required: true)  double latitude, @JsonKey(required: true)  double longitude, @JsonKey(required: true)  String? pickupInstructions, @JsonKey(required: true)  String? photoUrl, @JsonKey(required: true)  List<OpeningHours> hours, @JsonKey(required: true)  bool openNow, @JsonKey(required: true)  int distanceMeters, @JsonKey(required: true)  int? availableNow, @JsonKey(required: true)  String? reason)?  $default,) {final _that = this;
switch (_that) {
case _NearbyDrawer() when $default != null:
return $default(_that.id,_that.name,_that.address,_that.timezone,_that.latitude,_that.longitude,_that.pickupInstructions,_that.photoUrl,_that.hours,_that.openNow,_that.distanceMeters,_that.availableNow,_that.reason);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _NearbyDrawer implements NearbyDrawer {
  const _NearbyDrawer({@JsonKey(required: true) required this.id, @JsonKey(required: true) required this.name, @JsonKey(required: true) required this.address, @JsonKey(required: true) required this.timezone, @JsonKey(required: true) required this.latitude, @JsonKey(required: true) required this.longitude, @JsonKey(required: true) required this.pickupInstructions, @JsonKey(required: true) required this.photoUrl, @JsonKey(required: true) required final  List<OpeningHours> hours, @JsonKey(required: true) required this.openNow, @JsonKey(required: true) required this.distanceMeters, @JsonKey(required: true) required this.availableNow, @JsonKey(required: true) required this.reason}): _hours = hours;
  factory _NearbyDrawer.fromJson(Map<String, dynamic> json) => _$NearbyDrawerFromJson(json);

@override@JsonKey(required: true) final  String id;
@override@JsonKey(required: true) final  String name;
@override@JsonKey(required: true) final  String address;
@override@JsonKey(required: true) final  String timezone;
@override@JsonKey(required: true) final  double latitude;
@override@JsonKey(required: true) final  double longitude;
@override@JsonKey(required: true) final  String? pickupInstructions;
/// Cover photo: a path on the API (`/v1/media/<id>`), or null.
@override@JsonKey(required: true) final  String? photoUrl;
 final  List<OpeningHours> _hours;
@override@JsonKey(required: true) List<OpeningHours> get hours {
  if (_hours is EqualUnmodifiableListView) return _hours;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_hours);
}

@override@JsonKey(required: true) final  bool openNow;
/// Straight-line distance in meters.
@override@JsonKey(required: true) final  int distanceMeters;
/// Free units of the requested model right now (only when a model was given).
@override@JsonKey(required: true) final  int? availableNow;
/// `closed` or `out_of_stock` for drawers that are close but cannot serve the request; else null.
@override@JsonKey(required: true) final  String? reason;

/// Create a copy of NearbyDrawer
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$NearbyDrawerCopyWith<_NearbyDrawer> get copyWith => __$NearbyDrawerCopyWithImpl<_NearbyDrawer>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$NearbyDrawerToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _NearbyDrawer&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.address, address) || other.address == address)&&(identical(other.timezone, timezone) || other.timezone == timezone)&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.pickupInstructions, pickupInstructions) || other.pickupInstructions == pickupInstructions)&&(identical(other.photoUrl, photoUrl) || other.photoUrl == photoUrl)&&const DeepCollectionEquality().equals(other._hours, _hours)&&(identical(other.openNow, openNow) || other.openNow == openNow)&&(identical(other.distanceMeters, distanceMeters) || other.distanceMeters == distanceMeters)&&(identical(other.availableNow, availableNow) || other.availableNow == availableNow)&&(identical(other.reason, reason) || other.reason == reason));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,address,timezone,latitude,longitude,pickupInstructions,photoUrl,const DeepCollectionEquality().hash(_hours),openNow,distanceMeters,availableNow,reason);

@override
String toString() {
  return 'NearbyDrawer(id: $id, name: $name, address: $address, timezone: $timezone, latitude: $latitude, longitude: $longitude, pickupInstructions: $pickupInstructions, photoUrl: $photoUrl, hours: $hours, openNow: $openNow, distanceMeters: $distanceMeters, availableNow: $availableNow, reason: $reason)';
}


}

/// @nodoc
abstract mixin class _$NearbyDrawerCopyWith<$Res> implements $NearbyDrawerCopyWith<$Res> {
  factory _$NearbyDrawerCopyWith(_NearbyDrawer value, $Res Function(_NearbyDrawer) _then) = __$NearbyDrawerCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String id,@JsonKey(required: true) String name,@JsonKey(required: true) String address,@JsonKey(required: true) String timezone,@JsonKey(required: true) double latitude,@JsonKey(required: true) double longitude,@JsonKey(required: true) String? pickupInstructions,@JsonKey(required: true) String? photoUrl,@JsonKey(required: true) List<OpeningHours> hours,@JsonKey(required: true) bool openNow,@JsonKey(required: true) int distanceMeters,@JsonKey(required: true) int? availableNow,@JsonKey(required: true) String? reason
});




}
/// @nodoc
class __$NearbyDrawerCopyWithImpl<$Res>
    implements _$NearbyDrawerCopyWith<$Res> {
  __$NearbyDrawerCopyWithImpl(this._self, this._then);

  final _NearbyDrawer _self;
  final $Res Function(_NearbyDrawer) _then;

/// Create a copy of NearbyDrawer
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? address = null,Object? timezone = null,Object? latitude = null,Object? longitude = null,Object? pickupInstructions = freezed,Object? photoUrl = freezed,Object? hours = null,Object? openNow = null,Object? distanceMeters = null,Object? availableNow = freezed,Object? reason = freezed,}) {
  return _then(_NearbyDrawer(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,address: null == address ? _self.address : address // ignore: cast_nullable_to_non_nullable
as String,timezone: null == timezone ? _self.timezone : timezone // ignore: cast_nullable_to_non_nullable
as String,latitude: null == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double,longitude: null == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double,pickupInstructions: freezed == pickupInstructions ? _self.pickupInstructions : pickupInstructions // ignore: cast_nullable_to_non_nullable
as String?,photoUrl: freezed == photoUrl ? _self.photoUrl : photoUrl // ignore: cast_nullable_to_non_nullable
as String?,hours: null == hours ? _self._hours : hours // ignore: cast_nullable_to_non_nullable
as List<OpeningHours>,openNow: null == openNow ? _self.openNow : openNow // ignore: cast_nullable_to_non_nullable
as bool,distanceMeters: null == distanceMeters ? _self.distanceMeters : distanceMeters // ignore: cast_nullable_to_non_nullable
as int,availableNow: freezed == availableNow ? _self.availableNow : availableNow // ignore: cast_nullable_to_non_nullable
as int?,reason: freezed == reason ? _self.reason : reason // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$NearbyResponse {

/// Open drawers (with stock when a model was given), nearest first.
@JsonKey(required: true) List<NearbyDrawer> get drawers;/// Close by but closed or out of stock — shown so the app can explain.
@JsonKey(required: true) List<NearbyDrawer> get unavailable;
/// Create a copy of NearbyResponse
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$NearbyResponseCopyWith<NearbyResponse> get copyWith => _$NearbyResponseCopyWithImpl<NearbyResponse>(this as NearbyResponse, _$identity);

  /// Serializes this NearbyResponse to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is NearbyResponse&&const DeepCollectionEquality().equals(other.drawers, drawers)&&const DeepCollectionEquality().equals(other.unavailable, unavailable));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(drawers),const DeepCollectionEquality().hash(unavailable));

@override
String toString() {
  return 'NearbyResponse(drawers: $drawers, unavailable: $unavailable)';
}


}

/// @nodoc
abstract mixin class $NearbyResponseCopyWith<$Res>  {
  factory $NearbyResponseCopyWith(NearbyResponse value, $Res Function(NearbyResponse) _then) = _$NearbyResponseCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) List<NearbyDrawer> drawers,@JsonKey(required: true) List<NearbyDrawer> unavailable
});




}
/// @nodoc
class _$NearbyResponseCopyWithImpl<$Res>
    implements $NearbyResponseCopyWith<$Res> {
  _$NearbyResponseCopyWithImpl(this._self, this._then);

  final NearbyResponse _self;
  final $Res Function(NearbyResponse) _then;

/// Create a copy of NearbyResponse
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? drawers = null,Object? unavailable = null,}) {
  return _then(_self.copyWith(
drawers: null == drawers ? _self.drawers : drawers // ignore: cast_nullable_to_non_nullable
as List<NearbyDrawer>,unavailable: null == unavailable ? _self.unavailable : unavailable // ignore: cast_nullable_to_non_nullable
as List<NearbyDrawer>,
  ));
}

}


/// Adds pattern-matching-related methods to [NearbyResponse].
extension NearbyResponsePatterns on NearbyResponse {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _NearbyResponse value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _NearbyResponse() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _NearbyResponse value)  $default,){
final _that = this;
switch (_that) {
case _NearbyResponse():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _NearbyResponse value)?  $default,){
final _that = this;
switch (_that) {
case _NearbyResponse() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  List<NearbyDrawer> drawers, @JsonKey(required: true)  List<NearbyDrawer> unavailable)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _NearbyResponse() when $default != null:
return $default(_that.drawers,_that.unavailable);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  List<NearbyDrawer> drawers, @JsonKey(required: true)  List<NearbyDrawer> unavailable)  $default,) {final _that = this;
switch (_that) {
case _NearbyResponse():
return $default(_that.drawers,_that.unavailable);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  List<NearbyDrawer> drawers, @JsonKey(required: true)  List<NearbyDrawer> unavailable)?  $default,) {final _that = this;
switch (_that) {
case _NearbyResponse() when $default != null:
return $default(_that.drawers,_that.unavailable);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _NearbyResponse implements NearbyResponse {
  const _NearbyResponse({@JsonKey(required: true) required final  List<NearbyDrawer> drawers, @JsonKey(required: true) required final  List<NearbyDrawer> unavailable}): _drawers = drawers,_unavailable = unavailable;
  factory _NearbyResponse.fromJson(Map<String, dynamic> json) => _$NearbyResponseFromJson(json);

/// Open drawers (with stock when a model was given), nearest first.
 final  List<NearbyDrawer> _drawers;
/// Open drawers (with stock when a model was given), nearest first.
@override@JsonKey(required: true) List<NearbyDrawer> get drawers {
  if (_drawers is EqualUnmodifiableListView) return _drawers;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_drawers);
}

/// Close by but closed or out of stock — shown so the app can explain.
 final  List<NearbyDrawer> _unavailable;
/// Close by but closed or out of stock — shown so the app can explain.
@override@JsonKey(required: true) List<NearbyDrawer> get unavailable {
  if (_unavailable is EqualUnmodifiableListView) return _unavailable;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_unavailable);
}


/// Create a copy of NearbyResponse
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$NearbyResponseCopyWith<_NearbyResponse> get copyWith => __$NearbyResponseCopyWithImpl<_NearbyResponse>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$NearbyResponseToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _NearbyResponse&&const DeepCollectionEquality().equals(other._drawers, _drawers)&&const DeepCollectionEquality().equals(other._unavailable, _unavailable));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_drawers),const DeepCollectionEquality().hash(_unavailable));

@override
String toString() {
  return 'NearbyResponse(drawers: $drawers, unavailable: $unavailable)';
}


}

/// @nodoc
abstract mixin class _$NearbyResponseCopyWith<$Res> implements $NearbyResponseCopyWith<$Res> {
  factory _$NearbyResponseCopyWith(_NearbyResponse value, $Res Function(_NearbyResponse) _then) = __$NearbyResponseCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) List<NearbyDrawer> drawers,@JsonKey(required: true) List<NearbyDrawer> unavailable
});




}
/// @nodoc
class __$NearbyResponseCopyWithImpl<$Res>
    implements _$NearbyResponseCopyWith<$Res> {
  __$NearbyResponseCopyWithImpl(this._self, this._then);

  final _NearbyResponse _self;
  final $Res Function(_NearbyResponse) _then;

/// Create a copy of NearbyResponse
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? drawers = null,Object? unavailable = null,}) {
  return _then(_NearbyResponse(
drawers: null == drawers ? _self._drawers : drawers // ignore: cast_nullable_to_non_nullable
as List<NearbyDrawer>,unavailable: null == unavailable ? _self._unavailable : unavailable // ignore: cast_nullable_to_non_nullable
as List<NearbyDrawer>,
  ));
}


}


/// @nodoc
mixin _$InventoryEntry {

@JsonKey(required: true) String get itemModelId;@JsonKey(required: true) String get name;@JsonKey(required: true) String get categoryId;@JsonKey(required: true) List<String> get photos;@JsonKey(required: true) String? get description;@JsonKey(required: true) int get pricePerSlotPaise;@JsonKey(required: true) int get slotMinutes;@JsonKey(required: true) int get minDurationMin;@JsonKey(required: true) int get maxDurationMin;@JsonKey(required: true) int get depositPaise;@JsonKey(required: true) int get total;@JsonKey(required: true) int get availableNow;
/// Create a copy of InventoryEntry
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$InventoryEntryCopyWith<InventoryEntry> get copyWith => _$InventoryEntryCopyWithImpl<InventoryEntry>(this as InventoryEntry, _$identity);

  /// Serializes this InventoryEntry to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is InventoryEntry&&(identical(other.itemModelId, itemModelId) || other.itemModelId == itemModelId)&&(identical(other.name, name) || other.name == name)&&(identical(other.categoryId, categoryId) || other.categoryId == categoryId)&&const DeepCollectionEquality().equals(other.photos, photos)&&(identical(other.description, description) || other.description == description)&&(identical(other.pricePerSlotPaise, pricePerSlotPaise) || other.pricePerSlotPaise == pricePerSlotPaise)&&(identical(other.slotMinutes, slotMinutes) || other.slotMinutes == slotMinutes)&&(identical(other.minDurationMin, minDurationMin) || other.minDurationMin == minDurationMin)&&(identical(other.maxDurationMin, maxDurationMin) || other.maxDurationMin == maxDurationMin)&&(identical(other.depositPaise, depositPaise) || other.depositPaise == depositPaise)&&(identical(other.total, total) || other.total == total)&&(identical(other.availableNow, availableNow) || other.availableNow == availableNow));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,itemModelId,name,categoryId,const DeepCollectionEquality().hash(photos),description,pricePerSlotPaise,slotMinutes,minDurationMin,maxDurationMin,depositPaise,total,availableNow);

@override
String toString() {
  return 'InventoryEntry(itemModelId: $itemModelId, name: $name, categoryId: $categoryId, photos: $photos, description: $description, pricePerSlotPaise: $pricePerSlotPaise, slotMinutes: $slotMinutes, minDurationMin: $minDurationMin, maxDurationMin: $maxDurationMin, depositPaise: $depositPaise, total: $total, availableNow: $availableNow)';
}


}

/// @nodoc
abstract mixin class $InventoryEntryCopyWith<$Res>  {
  factory $InventoryEntryCopyWith(InventoryEntry value, $Res Function(InventoryEntry) _then) = _$InventoryEntryCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String itemModelId,@JsonKey(required: true) String name,@JsonKey(required: true) String categoryId,@JsonKey(required: true) List<String> photos,@JsonKey(required: true) String? description,@JsonKey(required: true) int pricePerSlotPaise,@JsonKey(required: true) int slotMinutes,@JsonKey(required: true) int minDurationMin,@JsonKey(required: true) int maxDurationMin,@JsonKey(required: true) int depositPaise,@JsonKey(required: true) int total,@JsonKey(required: true) int availableNow
});




}
/// @nodoc
class _$InventoryEntryCopyWithImpl<$Res>
    implements $InventoryEntryCopyWith<$Res> {
  _$InventoryEntryCopyWithImpl(this._self, this._then);

  final InventoryEntry _self;
  final $Res Function(InventoryEntry) _then;

/// Create a copy of InventoryEntry
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? itemModelId = null,Object? name = null,Object? categoryId = null,Object? photos = null,Object? description = freezed,Object? pricePerSlotPaise = null,Object? slotMinutes = null,Object? minDurationMin = null,Object? maxDurationMin = null,Object? depositPaise = null,Object? total = null,Object? availableNow = null,}) {
  return _then(_self.copyWith(
itemModelId: null == itemModelId ? _self.itemModelId : itemModelId // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,categoryId: null == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as String,photos: null == photos ? _self.photos : photos // ignore: cast_nullable_to_non_nullable
as List<String>,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,pricePerSlotPaise: null == pricePerSlotPaise ? _self.pricePerSlotPaise : pricePerSlotPaise // ignore: cast_nullable_to_non_nullable
as int,slotMinutes: null == slotMinutes ? _self.slotMinutes : slotMinutes // ignore: cast_nullable_to_non_nullable
as int,minDurationMin: null == minDurationMin ? _self.minDurationMin : minDurationMin // ignore: cast_nullable_to_non_nullable
as int,maxDurationMin: null == maxDurationMin ? _self.maxDurationMin : maxDurationMin // ignore: cast_nullable_to_non_nullable
as int,depositPaise: null == depositPaise ? _self.depositPaise : depositPaise // ignore: cast_nullable_to_non_nullable
as int,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,availableNow: null == availableNow ? _self.availableNow : availableNow // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [InventoryEntry].
extension InventoryEntryPatterns on InventoryEntry {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _InventoryEntry value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _InventoryEntry() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _InventoryEntry value)  $default,){
final _that = this;
switch (_that) {
case _InventoryEntry():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _InventoryEntry value)?  $default,){
final _that = this;
switch (_that) {
case _InventoryEntry() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String itemModelId, @JsonKey(required: true)  String name, @JsonKey(required: true)  String categoryId, @JsonKey(required: true)  List<String> photos, @JsonKey(required: true)  String? description, @JsonKey(required: true)  int pricePerSlotPaise, @JsonKey(required: true)  int slotMinutes, @JsonKey(required: true)  int minDurationMin, @JsonKey(required: true)  int maxDurationMin, @JsonKey(required: true)  int depositPaise, @JsonKey(required: true)  int total, @JsonKey(required: true)  int availableNow)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _InventoryEntry() when $default != null:
return $default(_that.itemModelId,_that.name,_that.categoryId,_that.photos,_that.description,_that.pricePerSlotPaise,_that.slotMinutes,_that.minDurationMin,_that.maxDurationMin,_that.depositPaise,_that.total,_that.availableNow);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String itemModelId, @JsonKey(required: true)  String name, @JsonKey(required: true)  String categoryId, @JsonKey(required: true)  List<String> photos, @JsonKey(required: true)  String? description, @JsonKey(required: true)  int pricePerSlotPaise, @JsonKey(required: true)  int slotMinutes, @JsonKey(required: true)  int minDurationMin, @JsonKey(required: true)  int maxDurationMin, @JsonKey(required: true)  int depositPaise, @JsonKey(required: true)  int total, @JsonKey(required: true)  int availableNow)  $default,) {final _that = this;
switch (_that) {
case _InventoryEntry():
return $default(_that.itemModelId,_that.name,_that.categoryId,_that.photos,_that.description,_that.pricePerSlotPaise,_that.slotMinutes,_that.minDurationMin,_that.maxDurationMin,_that.depositPaise,_that.total,_that.availableNow);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String itemModelId, @JsonKey(required: true)  String name, @JsonKey(required: true)  String categoryId, @JsonKey(required: true)  List<String> photos, @JsonKey(required: true)  String? description, @JsonKey(required: true)  int pricePerSlotPaise, @JsonKey(required: true)  int slotMinutes, @JsonKey(required: true)  int minDurationMin, @JsonKey(required: true)  int maxDurationMin, @JsonKey(required: true)  int depositPaise, @JsonKey(required: true)  int total, @JsonKey(required: true)  int availableNow)?  $default,) {final _that = this;
switch (_that) {
case _InventoryEntry() when $default != null:
return $default(_that.itemModelId,_that.name,_that.categoryId,_that.photos,_that.description,_that.pricePerSlotPaise,_that.slotMinutes,_that.minDurationMin,_that.maxDurationMin,_that.depositPaise,_that.total,_that.availableNow);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _InventoryEntry implements InventoryEntry {
  const _InventoryEntry({@JsonKey(required: true) required this.itemModelId, @JsonKey(required: true) required this.name, @JsonKey(required: true) required this.categoryId, @JsonKey(required: true) required final  List<String> photos, @JsonKey(required: true) required this.description, @JsonKey(required: true) required this.pricePerSlotPaise, @JsonKey(required: true) required this.slotMinutes, @JsonKey(required: true) required this.minDurationMin, @JsonKey(required: true) required this.maxDurationMin, @JsonKey(required: true) required this.depositPaise, @JsonKey(required: true) required this.total, @JsonKey(required: true) required this.availableNow}): _photos = photos;
  factory _InventoryEntry.fromJson(Map<String, dynamic> json) => _$InventoryEntryFromJson(json);

@override@JsonKey(required: true) final  String itemModelId;
@override@JsonKey(required: true) final  String name;
@override@JsonKey(required: true) final  String categoryId;
 final  List<String> _photos;
@override@JsonKey(required: true) List<String> get photos {
  if (_photos is EqualUnmodifiableListView) return _photos;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_photos);
}

@override@JsonKey(required: true) final  String? description;
@override@JsonKey(required: true) final  int pricePerSlotPaise;
@override@JsonKey(required: true) final  int slotMinutes;
@override@JsonKey(required: true) final  int minDurationMin;
@override@JsonKey(required: true) final  int maxDurationMin;
@override@JsonKey(required: true) final  int depositPaise;
@override@JsonKey(required: true) final  int total;
@override@JsonKey(required: true) final  int availableNow;

/// Create a copy of InventoryEntry
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$InventoryEntryCopyWith<_InventoryEntry> get copyWith => __$InventoryEntryCopyWithImpl<_InventoryEntry>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$InventoryEntryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _InventoryEntry&&(identical(other.itemModelId, itemModelId) || other.itemModelId == itemModelId)&&(identical(other.name, name) || other.name == name)&&(identical(other.categoryId, categoryId) || other.categoryId == categoryId)&&const DeepCollectionEquality().equals(other._photos, _photos)&&(identical(other.description, description) || other.description == description)&&(identical(other.pricePerSlotPaise, pricePerSlotPaise) || other.pricePerSlotPaise == pricePerSlotPaise)&&(identical(other.slotMinutes, slotMinutes) || other.slotMinutes == slotMinutes)&&(identical(other.minDurationMin, minDurationMin) || other.minDurationMin == minDurationMin)&&(identical(other.maxDurationMin, maxDurationMin) || other.maxDurationMin == maxDurationMin)&&(identical(other.depositPaise, depositPaise) || other.depositPaise == depositPaise)&&(identical(other.total, total) || other.total == total)&&(identical(other.availableNow, availableNow) || other.availableNow == availableNow));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,itemModelId,name,categoryId,const DeepCollectionEquality().hash(_photos),description,pricePerSlotPaise,slotMinutes,minDurationMin,maxDurationMin,depositPaise,total,availableNow);

@override
String toString() {
  return 'InventoryEntry(itemModelId: $itemModelId, name: $name, categoryId: $categoryId, photos: $photos, description: $description, pricePerSlotPaise: $pricePerSlotPaise, slotMinutes: $slotMinutes, minDurationMin: $minDurationMin, maxDurationMin: $maxDurationMin, depositPaise: $depositPaise, total: $total, availableNow: $availableNow)';
}


}

/// @nodoc
abstract mixin class _$InventoryEntryCopyWith<$Res> implements $InventoryEntryCopyWith<$Res> {
  factory _$InventoryEntryCopyWith(_InventoryEntry value, $Res Function(_InventoryEntry) _then) = __$InventoryEntryCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String itemModelId,@JsonKey(required: true) String name,@JsonKey(required: true) String categoryId,@JsonKey(required: true) List<String> photos,@JsonKey(required: true) String? description,@JsonKey(required: true) int pricePerSlotPaise,@JsonKey(required: true) int slotMinutes,@JsonKey(required: true) int minDurationMin,@JsonKey(required: true) int maxDurationMin,@JsonKey(required: true) int depositPaise,@JsonKey(required: true) int total,@JsonKey(required: true) int availableNow
});




}
/// @nodoc
class __$InventoryEntryCopyWithImpl<$Res>
    implements _$InventoryEntryCopyWith<$Res> {
  __$InventoryEntryCopyWithImpl(this._self, this._then);

  final _InventoryEntry _self;
  final $Res Function(_InventoryEntry) _then;

/// Create a copy of InventoryEntry
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? itemModelId = null,Object? name = null,Object? categoryId = null,Object? photos = null,Object? description = freezed,Object? pricePerSlotPaise = null,Object? slotMinutes = null,Object? minDurationMin = null,Object? maxDurationMin = null,Object? depositPaise = null,Object? total = null,Object? availableNow = null,}) {
  return _then(_InventoryEntry(
itemModelId: null == itemModelId ? _self.itemModelId : itemModelId // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,categoryId: null == categoryId ? _self.categoryId : categoryId // ignore: cast_nullable_to_non_nullable
as String,photos: null == photos ? _self._photos : photos // ignore: cast_nullable_to_non_nullable
as List<String>,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,pricePerSlotPaise: null == pricePerSlotPaise ? _self.pricePerSlotPaise : pricePerSlotPaise // ignore: cast_nullable_to_non_nullable
as int,slotMinutes: null == slotMinutes ? _self.slotMinutes : slotMinutes // ignore: cast_nullable_to_non_nullable
as int,minDurationMin: null == minDurationMin ? _self.minDurationMin : minDurationMin // ignore: cast_nullable_to_non_nullable
as int,maxDurationMin: null == maxDurationMin ? _self.maxDurationMin : maxDurationMin // ignore: cast_nullable_to_non_nullable
as int,depositPaise: null == depositPaise ? _self.depositPaise : depositPaise // ignore: cast_nullable_to_non_nullable
as int,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,availableNow: null == availableNow ? _self.availableNow : availableNow // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$AvailabilitySlot {

@JsonKey(required: true) DateTime get startsAt;/// Units that could be rented from this start for at least the minimum duration.
@JsonKey(required: true) int get freeAssets;/// The longest rental, in minutes, that some unit can do from this start.
@JsonKey(required: true) int get maxFreeMinutes;
/// Create a copy of AvailabilitySlot
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AvailabilitySlotCopyWith<AvailabilitySlot> get copyWith => _$AvailabilitySlotCopyWithImpl<AvailabilitySlot>(this as AvailabilitySlot, _$identity);

  /// Serializes this AvailabilitySlot to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AvailabilitySlot&&(identical(other.startsAt, startsAt) || other.startsAt == startsAt)&&(identical(other.freeAssets, freeAssets) || other.freeAssets == freeAssets)&&(identical(other.maxFreeMinutes, maxFreeMinutes) || other.maxFreeMinutes == maxFreeMinutes));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,startsAt,freeAssets,maxFreeMinutes);

@override
String toString() {
  return 'AvailabilitySlot(startsAt: $startsAt, freeAssets: $freeAssets, maxFreeMinutes: $maxFreeMinutes)';
}


}

/// @nodoc
abstract mixin class $AvailabilitySlotCopyWith<$Res>  {
  factory $AvailabilitySlotCopyWith(AvailabilitySlot value, $Res Function(AvailabilitySlot) _then) = _$AvailabilitySlotCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) DateTime startsAt,@JsonKey(required: true) int freeAssets,@JsonKey(required: true) int maxFreeMinutes
});




}
/// @nodoc
class _$AvailabilitySlotCopyWithImpl<$Res>
    implements $AvailabilitySlotCopyWith<$Res> {
  _$AvailabilitySlotCopyWithImpl(this._self, this._then);

  final AvailabilitySlot _self;
  final $Res Function(AvailabilitySlot) _then;

/// Create a copy of AvailabilitySlot
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? startsAt = null,Object? freeAssets = null,Object? maxFreeMinutes = null,}) {
  return _then(_self.copyWith(
startsAt: null == startsAt ? _self.startsAt : startsAt // ignore: cast_nullable_to_non_nullable
as DateTime,freeAssets: null == freeAssets ? _self.freeAssets : freeAssets // ignore: cast_nullable_to_non_nullable
as int,maxFreeMinutes: null == maxFreeMinutes ? _self.maxFreeMinutes : maxFreeMinutes // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [AvailabilitySlot].
extension AvailabilitySlotPatterns on AvailabilitySlot {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AvailabilitySlot value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AvailabilitySlot() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AvailabilitySlot value)  $default,){
final _that = this;
switch (_that) {
case _AvailabilitySlot():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AvailabilitySlot value)?  $default,){
final _that = this;
switch (_that) {
case _AvailabilitySlot() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  DateTime startsAt, @JsonKey(required: true)  int freeAssets, @JsonKey(required: true)  int maxFreeMinutes)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AvailabilitySlot() when $default != null:
return $default(_that.startsAt,_that.freeAssets,_that.maxFreeMinutes);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  DateTime startsAt, @JsonKey(required: true)  int freeAssets, @JsonKey(required: true)  int maxFreeMinutes)  $default,) {final _that = this;
switch (_that) {
case _AvailabilitySlot():
return $default(_that.startsAt,_that.freeAssets,_that.maxFreeMinutes);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  DateTime startsAt, @JsonKey(required: true)  int freeAssets, @JsonKey(required: true)  int maxFreeMinutes)?  $default,) {final _that = this;
switch (_that) {
case _AvailabilitySlot() when $default != null:
return $default(_that.startsAt,_that.freeAssets,_that.maxFreeMinutes);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _AvailabilitySlot implements AvailabilitySlot {
  const _AvailabilitySlot({@JsonKey(required: true) required this.startsAt, @JsonKey(required: true) required this.freeAssets, @JsonKey(required: true) required this.maxFreeMinutes});
  factory _AvailabilitySlot.fromJson(Map<String, dynamic> json) => _$AvailabilitySlotFromJson(json);

@override@JsonKey(required: true) final  DateTime startsAt;
/// Units that could be rented from this start for at least the minimum duration.
@override@JsonKey(required: true) final  int freeAssets;
/// The longest rental, in minutes, that some unit can do from this start.
@override@JsonKey(required: true) final  int maxFreeMinutes;

/// Create a copy of AvailabilitySlot
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AvailabilitySlotCopyWith<_AvailabilitySlot> get copyWith => __$AvailabilitySlotCopyWithImpl<_AvailabilitySlot>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AvailabilitySlotToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AvailabilitySlot&&(identical(other.startsAt, startsAt) || other.startsAt == startsAt)&&(identical(other.freeAssets, freeAssets) || other.freeAssets == freeAssets)&&(identical(other.maxFreeMinutes, maxFreeMinutes) || other.maxFreeMinutes == maxFreeMinutes));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,startsAt,freeAssets,maxFreeMinutes);

@override
String toString() {
  return 'AvailabilitySlot(startsAt: $startsAt, freeAssets: $freeAssets, maxFreeMinutes: $maxFreeMinutes)';
}


}

/// @nodoc
abstract mixin class _$AvailabilitySlotCopyWith<$Res> implements $AvailabilitySlotCopyWith<$Res> {
  factory _$AvailabilitySlotCopyWith(_AvailabilitySlot value, $Res Function(_AvailabilitySlot) _then) = __$AvailabilitySlotCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) DateTime startsAt,@JsonKey(required: true) int freeAssets,@JsonKey(required: true) int maxFreeMinutes
});




}
/// @nodoc
class __$AvailabilitySlotCopyWithImpl<$Res>
    implements _$AvailabilitySlotCopyWith<$Res> {
  __$AvailabilitySlotCopyWithImpl(this._self, this._then);

  final _AvailabilitySlot _self;
  final $Res Function(_AvailabilitySlot) _then;

/// Create a copy of AvailabilitySlot
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? startsAt = null,Object? freeAssets = null,Object? maxFreeMinutes = null,}) {
  return _then(_AvailabilitySlot(
startsAt: null == startsAt ? _self.startsAt : startsAt // ignore: cast_nullable_to_non_nullable
as DateTime,freeAssets: null == freeAssets ? _self.freeAssets : freeAssets // ignore: cast_nullable_to_non_nullable
as int,maxFreeMinutes: null == maxFreeMinutes ? _self.maxFreeMinutes : maxFreeMinutes // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$Availability {

@JsonKey(required: true) String get drawerId;@JsonKey(required: true) String get itemModelId;/// The calendar day in the drawer's time zone, `YYYY-MM-DD`.
@JsonKey(required: true) String get date;@JsonKey(required: true) String get timezone;@JsonKey(required: true) int get slotMinutes;@JsonKey(required: true) int get minDurationMin;@JsonKey(required: true) int get maxDurationMin;@JsonKey(required: true) int get bufferMin;@JsonKey(required: true) int get pricePerSlotPaise;@JsonKey(required: true) DateTime? get opensAt;@JsonKey(required: true) DateTime? get closesAt;@JsonKey(required: true) List<AvailabilitySlot> get slots;@JsonKey(required: true) bool get snapshot;@JsonKey(required: true) DateTime get generatedAt;
/// Create a copy of Availability
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AvailabilityCopyWith<Availability> get copyWith => _$AvailabilityCopyWithImpl<Availability>(this as Availability, _$identity);

  /// Serializes this Availability to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Availability&&(identical(other.drawerId, drawerId) || other.drawerId == drawerId)&&(identical(other.itemModelId, itemModelId) || other.itemModelId == itemModelId)&&(identical(other.date, date) || other.date == date)&&(identical(other.timezone, timezone) || other.timezone == timezone)&&(identical(other.slotMinutes, slotMinutes) || other.slotMinutes == slotMinutes)&&(identical(other.minDurationMin, minDurationMin) || other.minDurationMin == minDurationMin)&&(identical(other.maxDurationMin, maxDurationMin) || other.maxDurationMin == maxDurationMin)&&(identical(other.bufferMin, bufferMin) || other.bufferMin == bufferMin)&&(identical(other.pricePerSlotPaise, pricePerSlotPaise) || other.pricePerSlotPaise == pricePerSlotPaise)&&(identical(other.opensAt, opensAt) || other.opensAt == opensAt)&&(identical(other.closesAt, closesAt) || other.closesAt == closesAt)&&const DeepCollectionEquality().equals(other.slots, slots)&&(identical(other.snapshot, snapshot) || other.snapshot == snapshot)&&(identical(other.generatedAt, generatedAt) || other.generatedAt == generatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,drawerId,itemModelId,date,timezone,slotMinutes,minDurationMin,maxDurationMin,bufferMin,pricePerSlotPaise,opensAt,closesAt,const DeepCollectionEquality().hash(slots),snapshot,generatedAt);

@override
String toString() {
  return 'Availability(drawerId: $drawerId, itemModelId: $itemModelId, date: $date, timezone: $timezone, slotMinutes: $slotMinutes, minDurationMin: $minDurationMin, maxDurationMin: $maxDurationMin, bufferMin: $bufferMin, pricePerSlotPaise: $pricePerSlotPaise, opensAt: $opensAt, closesAt: $closesAt, slots: $slots, snapshot: $snapshot, generatedAt: $generatedAt)';
}


}

/// @nodoc
abstract mixin class $AvailabilityCopyWith<$Res>  {
  factory $AvailabilityCopyWith(Availability value, $Res Function(Availability) _then) = _$AvailabilityCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String drawerId,@JsonKey(required: true) String itemModelId,@JsonKey(required: true) String date,@JsonKey(required: true) String timezone,@JsonKey(required: true) int slotMinutes,@JsonKey(required: true) int minDurationMin,@JsonKey(required: true) int maxDurationMin,@JsonKey(required: true) int bufferMin,@JsonKey(required: true) int pricePerSlotPaise,@JsonKey(required: true) DateTime? opensAt,@JsonKey(required: true) DateTime? closesAt,@JsonKey(required: true) List<AvailabilitySlot> slots,@JsonKey(required: true) bool snapshot,@JsonKey(required: true) DateTime generatedAt
});




}
/// @nodoc
class _$AvailabilityCopyWithImpl<$Res>
    implements $AvailabilityCopyWith<$Res> {
  _$AvailabilityCopyWithImpl(this._self, this._then);

  final Availability _self;
  final $Res Function(Availability) _then;

/// Create a copy of Availability
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? drawerId = null,Object? itemModelId = null,Object? date = null,Object? timezone = null,Object? slotMinutes = null,Object? minDurationMin = null,Object? maxDurationMin = null,Object? bufferMin = null,Object? pricePerSlotPaise = null,Object? opensAt = freezed,Object? closesAt = freezed,Object? slots = null,Object? snapshot = null,Object? generatedAt = null,}) {
  return _then(_self.copyWith(
drawerId: null == drawerId ? _self.drawerId : drawerId // ignore: cast_nullable_to_non_nullable
as String,itemModelId: null == itemModelId ? _self.itemModelId : itemModelId // ignore: cast_nullable_to_non_nullable
as String,date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as String,timezone: null == timezone ? _self.timezone : timezone // ignore: cast_nullable_to_non_nullable
as String,slotMinutes: null == slotMinutes ? _self.slotMinutes : slotMinutes // ignore: cast_nullable_to_non_nullable
as int,minDurationMin: null == minDurationMin ? _self.minDurationMin : minDurationMin // ignore: cast_nullable_to_non_nullable
as int,maxDurationMin: null == maxDurationMin ? _self.maxDurationMin : maxDurationMin // ignore: cast_nullable_to_non_nullable
as int,bufferMin: null == bufferMin ? _self.bufferMin : bufferMin // ignore: cast_nullable_to_non_nullable
as int,pricePerSlotPaise: null == pricePerSlotPaise ? _self.pricePerSlotPaise : pricePerSlotPaise // ignore: cast_nullable_to_non_nullable
as int,opensAt: freezed == opensAt ? _self.opensAt : opensAt // ignore: cast_nullable_to_non_nullable
as DateTime?,closesAt: freezed == closesAt ? _self.closesAt : closesAt // ignore: cast_nullable_to_non_nullable
as DateTime?,slots: null == slots ? _self.slots : slots // ignore: cast_nullable_to_non_nullable
as List<AvailabilitySlot>,snapshot: null == snapshot ? _self.snapshot : snapshot // ignore: cast_nullable_to_non_nullable
as bool,generatedAt: null == generatedAt ? _self.generatedAt : generatedAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}

}


/// Adds pattern-matching-related methods to [Availability].
extension AvailabilityPatterns on Availability {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Availability value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Availability() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Availability value)  $default,){
final _that = this;
switch (_that) {
case _Availability():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Availability value)?  $default,){
final _that = this;
switch (_that) {
case _Availability() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String drawerId, @JsonKey(required: true)  String itemModelId, @JsonKey(required: true)  String date, @JsonKey(required: true)  String timezone, @JsonKey(required: true)  int slotMinutes, @JsonKey(required: true)  int minDurationMin, @JsonKey(required: true)  int maxDurationMin, @JsonKey(required: true)  int bufferMin, @JsonKey(required: true)  int pricePerSlotPaise, @JsonKey(required: true)  DateTime? opensAt, @JsonKey(required: true)  DateTime? closesAt, @JsonKey(required: true)  List<AvailabilitySlot> slots, @JsonKey(required: true)  bool snapshot, @JsonKey(required: true)  DateTime generatedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Availability() when $default != null:
return $default(_that.drawerId,_that.itemModelId,_that.date,_that.timezone,_that.slotMinutes,_that.minDurationMin,_that.maxDurationMin,_that.bufferMin,_that.pricePerSlotPaise,_that.opensAt,_that.closesAt,_that.slots,_that.snapshot,_that.generatedAt);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String drawerId, @JsonKey(required: true)  String itemModelId, @JsonKey(required: true)  String date, @JsonKey(required: true)  String timezone, @JsonKey(required: true)  int slotMinutes, @JsonKey(required: true)  int minDurationMin, @JsonKey(required: true)  int maxDurationMin, @JsonKey(required: true)  int bufferMin, @JsonKey(required: true)  int pricePerSlotPaise, @JsonKey(required: true)  DateTime? opensAt, @JsonKey(required: true)  DateTime? closesAt, @JsonKey(required: true)  List<AvailabilitySlot> slots, @JsonKey(required: true)  bool snapshot, @JsonKey(required: true)  DateTime generatedAt)  $default,) {final _that = this;
switch (_that) {
case _Availability():
return $default(_that.drawerId,_that.itemModelId,_that.date,_that.timezone,_that.slotMinutes,_that.minDurationMin,_that.maxDurationMin,_that.bufferMin,_that.pricePerSlotPaise,_that.opensAt,_that.closesAt,_that.slots,_that.snapshot,_that.generatedAt);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String drawerId, @JsonKey(required: true)  String itemModelId, @JsonKey(required: true)  String date, @JsonKey(required: true)  String timezone, @JsonKey(required: true)  int slotMinutes, @JsonKey(required: true)  int minDurationMin, @JsonKey(required: true)  int maxDurationMin, @JsonKey(required: true)  int bufferMin, @JsonKey(required: true)  int pricePerSlotPaise, @JsonKey(required: true)  DateTime? opensAt, @JsonKey(required: true)  DateTime? closesAt, @JsonKey(required: true)  List<AvailabilitySlot> slots, @JsonKey(required: true)  bool snapshot, @JsonKey(required: true)  DateTime generatedAt)?  $default,) {final _that = this;
switch (_that) {
case _Availability() when $default != null:
return $default(_that.drawerId,_that.itemModelId,_that.date,_that.timezone,_that.slotMinutes,_that.minDurationMin,_that.maxDurationMin,_that.bufferMin,_that.pricePerSlotPaise,_that.opensAt,_that.closesAt,_that.slots,_that.snapshot,_that.generatedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Availability implements Availability {
  const _Availability({@JsonKey(required: true) required this.drawerId, @JsonKey(required: true) required this.itemModelId, @JsonKey(required: true) required this.date, @JsonKey(required: true) required this.timezone, @JsonKey(required: true) required this.slotMinutes, @JsonKey(required: true) required this.minDurationMin, @JsonKey(required: true) required this.maxDurationMin, @JsonKey(required: true) required this.bufferMin, @JsonKey(required: true) required this.pricePerSlotPaise, @JsonKey(required: true) required this.opensAt, @JsonKey(required: true) required this.closesAt, @JsonKey(required: true) required final  List<AvailabilitySlot> slots, @JsonKey(required: true) required this.snapshot, @JsonKey(required: true) required this.generatedAt}): _slots = slots;
  factory _Availability.fromJson(Map<String, dynamic> json) => _$AvailabilityFromJson(json);

@override@JsonKey(required: true) final  String drawerId;
@override@JsonKey(required: true) final  String itemModelId;
/// The calendar day in the drawer's time zone, `YYYY-MM-DD`.
@override@JsonKey(required: true) final  String date;
@override@JsonKey(required: true) final  String timezone;
@override@JsonKey(required: true) final  int slotMinutes;
@override@JsonKey(required: true) final  int minDurationMin;
@override@JsonKey(required: true) final  int maxDurationMin;
@override@JsonKey(required: true) final  int bufferMin;
@override@JsonKey(required: true) final  int pricePerSlotPaise;
@override@JsonKey(required: true) final  DateTime? opensAt;
@override@JsonKey(required: true) final  DateTime? closesAt;
 final  List<AvailabilitySlot> _slots;
@override@JsonKey(required: true) List<AvailabilitySlot> get slots {
  if (_slots is EqualUnmodifiableListView) return _slots;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_slots);
}

@override@JsonKey(required: true) final  bool snapshot;
@override@JsonKey(required: true) final  DateTime generatedAt;

/// Create a copy of Availability
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AvailabilityCopyWith<_Availability> get copyWith => __$AvailabilityCopyWithImpl<_Availability>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AvailabilityToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Availability&&(identical(other.drawerId, drawerId) || other.drawerId == drawerId)&&(identical(other.itemModelId, itemModelId) || other.itemModelId == itemModelId)&&(identical(other.date, date) || other.date == date)&&(identical(other.timezone, timezone) || other.timezone == timezone)&&(identical(other.slotMinutes, slotMinutes) || other.slotMinutes == slotMinutes)&&(identical(other.minDurationMin, minDurationMin) || other.minDurationMin == minDurationMin)&&(identical(other.maxDurationMin, maxDurationMin) || other.maxDurationMin == maxDurationMin)&&(identical(other.bufferMin, bufferMin) || other.bufferMin == bufferMin)&&(identical(other.pricePerSlotPaise, pricePerSlotPaise) || other.pricePerSlotPaise == pricePerSlotPaise)&&(identical(other.opensAt, opensAt) || other.opensAt == opensAt)&&(identical(other.closesAt, closesAt) || other.closesAt == closesAt)&&const DeepCollectionEquality().equals(other._slots, _slots)&&(identical(other.snapshot, snapshot) || other.snapshot == snapshot)&&(identical(other.generatedAt, generatedAt) || other.generatedAt == generatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,drawerId,itemModelId,date,timezone,slotMinutes,minDurationMin,maxDurationMin,bufferMin,pricePerSlotPaise,opensAt,closesAt,const DeepCollectionEquality().hash(_slots),snapshot,generatedAt);

@override
String toString() {
  return 'Availability(drawerId: $drawerId, itemModelId: $itemModelId, date: $date, timezone: $timezone, slotMinutes: $slotMinutes, minDurationMin: $minDurationMin, maxDurationMin: $maxDurationMin, bufferMin: $bufferMin, pricePerSlotPaise: $pricePerSlotPaise, opensAt: $opensAt, closesAt: $closesAt, slots: $slots, snapshot: $snapshot, generatedAt: $generatedAt)';
}


}

/// @nodoc
abstract mixin class _$AvailabilityCopyWith<$Res> implements $AvailabilityCopyWith<$Res> {
  factory _$AvailabilityCopyWith(_Availability value, $Res Function(_Availability) _then) = __$AvailabilityCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String drawerId,@JsonKey(required: true) String itemModelId,@JsonKey(required: true) String date,@JsonKey(required: true) String timezone,@JsonKey(required: true) int slotMinutes,@JsonKey(required: true) int minDurationMin,@JsonKey(required: true) int maxDurationMin,@JsonKey(required: true) int bufferMin,@JsonKey(required: true) int pricePerSlotPaise,@JsonKey(required: true) DateTime? opensAt,@JsonKey(required: true) DateTime? closesAt,@JsonKey(required: true) List<AvailabilitySlot> slots,@JsonKey(required: true) bool snapshot,@JsonKey(required: true) DateTime generatedAt
});




}
/// @nodoc
class __$AvailabilityCopyWithImpl<$Res>
    implements _$AvailabilityCopyWith<$Res> {
  __$AvailabilityCopyWithImpl(this._self, this._then);

  final _Availability _self;
  final $Res Function(_Availability) _then;

/// Create a copy of Availability
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? drawerId = null,Object? itemModelId = null,Object? date = null,Object? timezone = null,Object? slotMinutes = null,Object? minDurationMin = null,Object? maxDurationMin = null,Object? bufferMin = null,Object? pricePerSlotPaise = null,Object? opensAt = freezed,Object? closesAt = freezed,Object? slots = null,Object? snapshot = null,Object? generatedAt = null,}) {
  return _then(_Availability(
drawerId: null == drawerId ? _self.drawerId : drawerId // ignore: cast_nullable_to_non_nullable
as String,itemModelId: null == itemModelId ? _self.itemModelId : itemModelId // ignore: cast_nullable_to_non_nullable
as String,date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as String,timezone: null == timezone ? _self.timezone : timezone // ignore: cast_nullable_to_non_nullable
as String,slotMinutes: null == slotMinutes ? _self.slotMinutes : slotMinutes // ignore: cast_nullable_to_non_nullable
as int,minDurationMin: null == minDurationMin ? _self.minDurationMin : minDurationMin // ignore: cast_nullable_to_non_nullable
as int,maxDurationMin: null == maxDurationMin ? _self.maxDurationMin : maxDurationMin // ignore: cast_nullable_to_non_nullable
as int,bufferMin: null == bufferMin ? _self.bufferMin : bufferMin // ignore: cast_nullable_to_non_nullable
as int,pricePerSlotPaise: null == pricePerSlotPaise ? _self.pricePerSlotPaise : pricePerSlotPaise // ignore: cast_nullable_to_non_nullable
as int,opensAt: freezed == opensAt ? _self.opensAt : opensAt // ignore: cast_nullable_to_non_nullable
as DateTime?,closesAt: freezed == closesAt ? _self.closesAt : closesAt // ignore: cast_nullable_to_non_nullable
as DateTime?,slots: null == slots ? _self._slots : slots // ignore: cast_nullable_to_non_nullable
as List<AvailabilitySlot>,snapshot: null == snapshot ? _self.snapshot : snapshot // ignore: cast_nullable_to_non_nullable
as bool,generatedAt: null == generatedAt ? _self.generatedAt : generatedAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}


}

// dart format on
