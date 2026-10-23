// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'booking.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$CreateBookingRequest {

@JsonKey(required: true) String get drawerId;@JsonKey(required: true) String get itemModelId;/// UTC instant on a whole minute; serialised as ISO-8601 with `Z`.
@JsonKey(required: true) DateTime get startsAt;@JsonKey(required: true) int get durationMinutes;
/// Create a copy of CreateBookingRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CreateBookingRequestCopyWith<CreateBookingRequest> get copyWith => _$CreateBookingRequestCopyWithImpl<CreateBookingRequest>(this as CreateBookingRequest, _$identity);

  /// Serializes this CreateBookingRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CreateBookingRequest&&(identical(other.drawerId, drawerId) || other.drawerId == drawerId)&&(identical(other.itemModelId, itemModelId) || other.itemModelId == itemModelId)&&(identical(other.startsAt, startsAt) || other.startsAt == startsAt)&&(identical(other.durationMinutes, durationMinutes) || other.durationMinutes == durationMinutes));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,drawerId,itemModelId,startsAt,durationMinutes);

@override
String toString() {
  return 'CreateBookingRequest(drawerId: $drawerId, itemModelId: $itemModelId, startsAt: $startsAt, durationMinutes: $durationMinutes)';
}


}

/// @nodoc
abstract mixin class $CreateBookingRequestCopyWith<$Res>  {
  factory $CreateBookingRequestCopyWith(CreateBookingRequest value, $Res Function(CreateBookingRequest) _then) = _$CreateBookingRequestCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String drawerId,@JsonKey(required: true) String itemModelId,@JsonKey(required: true) DateTime startsAt,@JsonKey(required: true) int durationMinutes
});




}
/// @nodoc
class _$CreateBookingRequestCopyWithImpl<$Res>
    implements $CreateBookingRequestCopyWith<$Res> {
  _$CreateBookingRequestCopyWithImpl(this._self, this._then);

  final CreateBookingRequest _self;
  final $Res Function(CreateBookingRequest) _then;

/// Create a copy of CreateBookingRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? drawerId = null,Object? itemModelId = null,Object? startsAt = null,Object? durationMinutes = null,}) {
  return _then(_self.copyWith(
drawerId: null == drawerId ? _self.drawerId : drawerId // ignore: cast_nullable_to_non_nullable
as String,itemModelId: null == itemModelId ? _self.itemModelId : itemModelId // ignore: cast_nullable_to_non_nullable
as String,startsAt: null == startsAt ? _self.startsAt : startsAt // ignore: cast_nullable_to_non_nullable
as DateTime,durationMinutes: null == durationMinutes ? _self.durationMinutes : durationMinutes // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [CreateBookingRequest].
extension CreateBookingRequestPatterns on CreateBookingRequest {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CreateBookingRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CreateBookingRequest() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CreateBookingRequest value)  $default,){
final _that = this;
switch (_that) {
case _CreateBookingRequest():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CreateBookingRequest value)?  $default,){
final _that = this;
switch (_that) {
case _CreateBookingRequest() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String drawerId, @JsonKey(required: true)  String itemModelId, @JsonKey(required: true)  DateTime startsAt, @JsonKey(required: true)  int durationMinutes)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CreateBookingRequest() when $default != null:
return $default(_that.drawerId,_that.itemModelId,_that.startsAt,_that.durationMinutes);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String drawerId, @JsonKey(required: true)  String itemModelId, @JsonKey(required: true)  DateTime startsAt, @JsonKey(required: true)  int durationMinutes)  $default,) {final _that = this;
switch (_that) {
case _CreateBookingRequest():
return $default(_that.drawerId,_that.itemModelId,_that.startsAt,_that.durationMinutes);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String drawerId, @JsonKey(required: true)  String itemModelId, @JsonKey(required: true)  DateTime startsAt, @JsonKey(required: true)  int durationMinutes)?  $default,) {final _that = this;
switch (_that) {
case _CreateBookingRequest() when $default != null:
return $default(_that.drawerId,_that.itemModelId,_that.startsAt,_that.durationMinutes);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CreateBookingRequest implements CreateBookingRequest {
  const _CreateBookingRequest({@JsonKey(required: true) required this.drawerId, @JsonKey(required: true) required this.itemModelId, @JsonKey(required: true) required this.startsAt, @JsonKey(required: true) required this.durationMinutes});
  factory _CreateBookingRequest.fromJson(Map<String, dynamic> json) => _$CreateBookingRequestFromJson(json);

@override@JsonKey(required: true) final  String drawerId;
@override@JsonKey(required: true) final  String itemModelId;
/// UTC instant on a whole minute; serialised as ISO-8601 with `Z`.
@override@JsonKey(required: true) final  DateTime startsAt;
@override@JsonKey(required: true) final  int durationMinutes;

/// Create a copy of CreateBookingRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CreateBookingRequestCopyWith<_CreateBookingRequest> get copyWith => __$CreateBookingRequestCopyWithImpl<_CreateBookingRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CreateBookingRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CreateBookingRequest&&(identical(other.drawerId, drawerId) || other.drawerId == drawerId)&&(identical(other.itemModelId, itemModelId) || other.itemModelId == itemModelId)&&(identical(other.startsAt, startsAt) || other.startsAt == startsAt)&&(identical(other.durationMinutes, durationMinutes) || other.durationMinutes == durationMinutes));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,drawerId,itemModelId,startsAt,durationMinutes);

@override
String toString() {
  return 'CreateBookingRequest(drawerId: $drawerId, itemModelId: $itemModelId, startsAt: $startsAt, durationMinutes: $durationMinutes)';
}


}

/// @nodoc
abstract mixin class _$CreateBookingRequestCopyWith<$Res> implements $CreateBookingRequestCopyWith<$Res> {
  factory _$CreateBookingRequestCopyWith(_CreateBookingRequest value, $Res Function(_CreateBookingRequest) _then) = __$CreateBookingRequestCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String drawerId,@JsonKey(required: true) String itemModelId,@JsonKey(required: true) DateTime startsAt,@JsonKey(required: true) int durationMinutes
});




}
/// @nodoc
class __$CreateBookingRequestCopyWithImpl<$Res>
    implements _$CreateBookingRequestCopyWith<$Res> {
  __$CreateBookingRequestCopyWithImpl(this._self, this._then);

  final _CreateBookingRequest _self;
  final $Res Function(_CreateBookingRequest) _then;

/// Create a copy of CreateBookingRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? drawerId = null,Object? itemModelId = null,Object? startsAt = null,Object? durationMinutes = null,}) {
  return _then(_CreateBookingRequest(
drawerId: null == drawerId ? _self.drawerId : drawerId // ignore: cast_nullable_to_non_nullable
as String,itemModelId: null == itemModelId ? _self.itemModelId : itemModelId // ignore: cast_nullable_to_non_nullable
as String,startsAt: null == startsAt ? _self.startsAt : startsAt // ignore: cast_nullable_to_non_nullable
as DateTime,durationMinutes: null == durationMinutes ? _self.durationMinutes : durationMinutes // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$BookingDrawer {

@JsonKey(required: true) String get id;@JsonKey(required: true) String get name;@JsonKey(required: true) String get address;@JsonKey(required: true) String get timezone;
/// Create a copy of BookingDrawer
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$BookingDrawerCopyWith<BookingDrawer> get copyWith => _$BookingDrawerCopyWithImpl<BookingDrawer>(this as BookingDrawer, _$identity);

  /// Serializes this BookingDrawer to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is BookingDrawer&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.address, address) || other.address == address)&&(identical(other.timezone, timezone) || other.timezone == timezone));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,address,timezone);

@override
String toString() {
  return 'BookingDrawer(id: $id, name: $name, address: $address, timezone: $timezone)';
}


}

/// @nodoc
abstract mixin class $BookingDrawerCopyWith<$Res>  {
  factory $BookingDrawerCopyWith(BookingDrawer value, $Res Function(BookingDrawer) _then) = _$BookingDrawerCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String id,@JsonKey(required: true) String name,@JsonKey(required: true) String address,@JsonKey(required: true) String timezone
});




}
/// @nodoc
class _$BookingDrawerCopyWithImpl<$Res>
    implements $BookingDrawerCopyWith<$Res> {
  _$BookingDrawerCopyWithImpl(this._self, this._then);

  final BookingDrawer _self;
  final $Res Function(BookingDrawer) _then;

/// Create a copy of BookingDrawer
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? address = null,Object? timezone = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,address: null == address ? _self.address : address // ignore: cast_nullable_to_non_nullable
as String,timezone: null == timezone ? _self.timezone : timezone // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [BookingDrawer].
extension BookingDrawerPatterns on BookingDrawer {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _BookingDrawer value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _BookingDrawer() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _BookingDrawer value)  $default,){
final _that = this;
switch (_that) {
case _BookingDrawer():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _BookingDrawer value)?  $default,){
final _that = this;
switch (_that) {
case _BookingDrawer() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String id, @JsonKey(required: true)  String name, @JsonKey(required: true)  String address, @JsonKey(required: true)  String timezone)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _BookingDrawer() when $default != null:
return $default(_that.id,_that.name,_that.address,_that.timezone);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String id, @JsonKey(required: true)  String name, @JsonKey(required: true)  String address, @JsonKey(required: true)  String timezone)  $default,) {final _that = this;
switch (_that) {
case _BookingDrawer():
return $default(_that.id,_that.name,_that.address,_that.timezone);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String id, @JsonKey(required: true)  String name, @JsonKey(required: true)  String address, @JsonKey(required: true)  String timezone)?  $default,) {final _that = this;
switch (_that) {
case _BookingDrawer() when $default != null:
return $default(_that.id,_that.name,_that.address,_that.timezone);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _BookingDrawer implements BookingDrawer {
  const _BookingDrawer({@JsonKey(required: true) required this.id, @JsonKey(required: true) required this.name, @JsonKey(required: true) required this.address, @JsonKey(required: true) required this.timezone});
  factory _BookingDrawer.fromJson(Map<String, dynamic> json) => _$BookingDrawerFromJson(json);

@override@JsonKey(required: true) final  String id;
@override@JsonKey(required: true) final  String name;
@override@JsonKey(required: true) final  String address;
@override@JsonKey(required: true) final  String timezone;

/// Create a copy of BookingDrawer
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$BookingDrawerCopyWith<_BookingDrawer> get copyWith => __$BookingDrawerCopyWithImpl<_BookingDrawer>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$BookingDrawerToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _BookingDrawer&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.address, address) || other.address == address)&&(identical(other.timezone, timezone) || other.timezone == timezone));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,address,timezone);

@override
String toString() {
  return 'BookingDrawer(id: $id, name: $name, address: $address, timezone: $timezone)';
}


}

/// @nodoc
abstract mixin class _$BookingDrawerCopyWith<$Res> implements $BookingDrawerCopyWith<$Res> {
  factory _$BookingDrawerCopyWith(_BookingDrawer value, $Res Function(_BookingDrawer) _then) = __$BookingDrawerCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String id,@JsonKey(required: true) String name,@JsonKey(required: true) String address,@JsonKey(required: true) String timezone
});




}
/// @nodoc
class __$BookingDrawerCopyWithImpl<$Res>
    implements _$BookingDrawerCopyWith<$Res> {
  __$BookingDrawerCopyWithImpl(this._self, this._then);

  final _BookingDrawer _self;
  final $Res Function(_BookingDrawer) _then;

/// Create a copy of BookingDrawer
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? address = null,Object? timezone = null,}) {
  return _then(_BookingDrawer(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,address: null == address ? _self.address : address // ignore: cast_nullable_to_non_nullable
as String,timezone: null == timezone ? _self.timezone : timezone // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$BookingItem {

@JsonKey(required: true) String get id;@JsonKey(required: true) String get name;/// Cover photo of the product: a path on the API or a link, or null.
@JsonKey(required: true) String? get photoUrl;
/// Create a copy of BookingItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$BookingItemCopyWith<BookingItem> get copyWith => _$BookingItemCopyWithImpl<BookingItem>(this as BookingItem, _$identity);

  /// Serializes this BookingItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is BookingItem&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.photoUrl, photoUrl) || other.photoUrl == photoUrl));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,photoUrl);

@override
String toString() {
  return 'BookingItem(id: $id, name: $name, photoUrl: $photoUrl)';
}


}

/// @nodoc
abstract mixin class $BookingItemCopyWith<$Res>  {
  factory $BookingItemCopyWith(BookingItem value, $Res Function(BookingItem) _then) = _$BookingItemCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String id,@JsonKey(required: true) String name,@JsonKey(required: true) String? photoUrl
});




}
/// @nodoc
class _$BookingItemCopyWithImpl<$Res>
    implements $BookingItemCopyWith<$Res> {
  _$BookingItemCopyWithImpl(this._self, this._then);

  final BookingItem _self;
  final $Res Function(BookingItem) _then;

/// Create a copy of BookingItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? photoUrl = freezed,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,photoUrl: freezed == photoUrl ? _self.photoUrl : photoUrl // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [BookingItem].
extension BookingItemPatterns on BookingItem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _BookingItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _BookingItem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _BookingItem value)  $default,){
final _that = this;
switch (_that) {
case _BookingItem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _BookingItem value)?  $default,){
final _that = this;
switch (_that) {
case _BookingItem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String id, @JsonKey(required: true)  String name, @JsonKey(required: true)  String? photoUrl)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _BookingItem() when $default != null:
return $default(_that.id,_that.name,_that.photoUrl);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String id, @JsonKey(required: true)  String name, @JsonKey(required: true)  String? photoUrl)  $default,) {final _that = this;
switch (_that) {
case _BookingItem():
return $default(_that.id,_that.name,_that.photoUrl);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String id, @JsonKey(required: true)  String name, @JsonKey(required: true)  String? photoUrl)?  $default,) {final _that = this;
switch (_that) {
case _BookingItem() when $default != null:
return $default(_that.id,_that.name,_that.photoUrl);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _BookingItem implements BookingItem {
  const _BookingItem({@JsonKey(required: true) required this.id, @JsonKey(required: true) required this.name, @JsonKey(required: true) required this.photoUrl});
  factory _BookingItem.fromJson(Map<String, dynamic> json) => _$BookingItemFromJson(json);

@override@JsonKey(required: true) final  String id;
@override@JsonKey(required: true) final  String name;
/// Cover photo of the product: a path on the API or a link, or null.
@override@JsonKey(required: true) final  String? photoUrl;

/// Create a copy of BookingItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$BookingItemCopyWith<_BookingItem> get copyWith => __$BookingItemCopyWithImpl<_BookingItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$BookingItemToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _BookingItem&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.photoUrl, photoUrl) || other.photoUrl == photoUrl));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,name,photoUrl);

@override
String toString() {
  return 'BookingItem(id: $id, name: $name, photoUrl: $photoUrl)';
}


}

/// @nodoc
abstract mixin class _$BookingItemCopyWith<$Res> implements $BookingItemCopyWith<$Res> {
  factory _$BookingItemCopyWith(_BookingItem value, $Res Function(_BookingItem) _then) = __$BookingItemCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String id,@JsonKey(required: true) String name,@JsonKey(required: true) String? photoUrl
});




}
/// @nodoc
class __$BookingItemCopyWithImpl<$Res>
    implements _$BookingItemCopyWith<$Res> {
  __$BookingItemCopyWithImpl(this._self, this._then);

  final _BookingItem _self;
  final $Res Function(_BookingItem) _then;

/// Create a copy of BookingItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? photoUrl = freezed,}) {
  return _then(_BookingItem(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,photoUrl: freezed == photoUrl ? _self.photoUrl : photoUrl // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$BookingPayment {

/// `created`, `captured`, `failed` or `refunded`.
@JsonKey(required: true) String get status;@JsonKey(required: true) String get orderId;@JsonKey(required: true) int get amountPaise;
/// Create a copy of BookingPayment
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$BookingPaymentCopyWith<BookingPayment> get copyWith => _$BookingPaymentCopyWithImpl<BookingPayment>(this as BookingPayment, _$identity);

  /// Serializes this BookingPayment to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is BookingPayment&&(identical(other.status, status) || other.status == status)&&(identical(other.orderId, orderId) || other.orderId == orderId)&&(identical(other.amountPaise, amountPaise) || other.amountPaise == amountPaise));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,orderId,amountPaise);

@override
String toString() {
  return 'BookingPayment(status: $status, orderId: $orderId, amountPaise: $amountPaise)';
}


}

/// @nodoc
abstract mixin class $BookingPaymentCopyWith<$Res>  {
  factory $BookingPaymentCopyWith(BookingPayment value, $Res Function(BookingPayment) _then) = _$BookingPaymentCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String status,@JsonKey(required: true) String orderId,@JsonKey(required: true) int amountPaise
});




}
/// @nodoc
class _$BookingPaymentCopyWithImpl<$Res>
    implements $BookingPaymentCopyWith<$Res> {
  _$BookingPaymentCopyWithImpl(this._self, this._then);

  final BookingPayment _self;
  final $Res Function(BookingPayment) _then;

/// Create a copy of BookingPayment
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? status = null,Object? orderId = null,Object? amountPaise = null,}) {
  return _then(_self.copyWith(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,orderId: null == orderId ? _self.orderId : orderId // ignore: cast_nullable_to_non_nullable
as String,amountPaise: null == amountPaise ? _self.amountPaise : amountPaise // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [BookingPayment].
extension BookingPaymentPatterns on BookingPayment {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _BookingPayment value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _BookingPayment() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _BookingPayment value)  $default,){
final _that = this;
switch (_that) {
case _BookingPayment():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _BookingPayment value)?  $default,){
final _that = this;
switch (_that) {
case _BookingPayment() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String status, @JsonKey(required: true)  String orderId, @JsonKey(required: true)  int amountPaise)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _BookingPayment() when $default != null:
return $default(_that.status,_that.orderId,_that.amountPaise);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String status, @JsonKey(required: true)  String orderId, @JsonKey(required: true)  int amountPaise)  $default,) {final _that = this;
switch (_that) {
case _BookingPayment():
return $default(_that.status,_that.orderId,_that.amountPaise);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String status, @JsonKey(required: true)  String orderId, @JsonKey(required: true)  int amountPaise)?  $default,) {final _that = this;
switch (_that) {
case _BookingPayment() when $default != null:
return $default(_that.status,_that.orderId,_that.amountPaise);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _BookingPayment implements BookingPayment {
  const _BookingPayment({@JsonKey(required: true) required this.status, @JsonKey(required: true) required this.orderId, @JsonKey(required: true) required this.amountPaise});
  factory _BookingPayment.fromJson(Map<String, dynamic> json) => _$BookingPaymentFromJson(json);

/// `created`, `captured`, `failed` or `refunded`.
@override@JsonKey(required: true) final  String status;
@override@JsonKey(required: true) final  String orderId;
@override@JsonKey(required: true) final  int amountPaise;

/// Create a copy of BookingPayment
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$BookingPaymentCopyWith<_BookingPayment> get copyWith => __$BookingPaymentCopyWithImpl<_BookingPayment>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$BookingPaymentToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _BookingPayment&&(identical(other.status, status) || other.status == status)&&(identical(other.orderId, orderId) || other.orderId == orderId)&&(identical(other.amountPaise, amountPaise) || other.amountPaise == amountPaise));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,orderId,amountPaise);

@override
String toString() {
  return 'BookingPayment(status: $status, orderId: $orderId, amountPaise: $amountPaise)';
}


}

/// @nodoc
abstract mixin class _$BookingPaymentCopyWith<$Res> implements $BookingPaymentCopyWith<$Res> {
  factory _$BookingPaymentCopyWith(_BookingPayment value, $Res Function(_BookingPayment) _then) = __$BookingPaymentCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String status,@JsonKey(required: true) String orderId,@JsonKey(required: true) int amountPaise
});




}
/// @nodoc
class __$BookingPaymentCopyWithImpl<$Res>
    implements _$BookingPaymentCopyWith<$Res> {
  __$BookingPaymentCopyWithImpl(this._self, this._then);

  final _BookingPayment _self;
  final $Res Function(_BookingPayment) _then;

/// Create a copy of BookingPayment
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? status = null,Object? orderId = null,Object? amountPaise = null,}) {
  return _then(_BookingPayment(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,orderId: null == orderId ? _self.orderId : orderId // ignore: cast_nullable_to_non_nullable
as String,amountPaise: null == amountPaise ? _self.amountPaise : amountPaise // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$BookingRefund {

@JsonKey(required: true) int get amountPaise;/// `pending`, `processed` or `failed`.
@JsonKey(required: true) String get status;
/// Create a copy of BookingRefund
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$BookingRefundCopyWith<BookingRefund> get copyWith => _$BookingRefundCopyWithImpl<BookingRefund>(this as BookingRefund, _$identity);

  /// Serializes this BookingRefund to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is BookingRefund&&(identical(other.amountPaise, amountPaise) || other.amountPaise == amountPaise)&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,amountPaise,status);

@override
String toString() {
  return 'BookingRefund(amountPaise: $amountPaise, status: $status)';
}


}

/// @nodoc
abstract mixin class $BookingRefundCopyWith<$Res>  {
  factory $BookingRefundCopyWith(BookingRefund value, $Res Function(BookingRefund) _then) = _$BookingRefundCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) int amountPaise,@JsonKey(required: true) String status
});




}
/// @nodoc
class _$BookingRefundCopyWithImpl<$Res>
    implements $BookingRefundCopyWith<$Res> {
  _$BookingRefundCopyWithImpl(this._self, this._then);

  final BookingRefund _self;
  final $Res Function(BookingRefund) _then;

/// Create a copy of BookingRefund
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? amountPaise = null,Object? status = null,}) {
  return _then(_self.copyWith(
amountPaise: null == amountPaise ? _self.amountPaise : amountPaise // ignore: cast_nullable_to_non_nullable
as int,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [BookingRefund].
extension BookingRefundPatterns on BookingRefund {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _BookingRefund value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _BookingRefund() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _BookingRefund value)  $default,){
final _that = this;
switch (_that) {
case _BookingRefund():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _BookingRefund value)?  $default,){
final _that = this;
switch (_that) {
case _BookingRefund() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  int amountPaise, @JsonKey(required: true)  String status)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _BookingRefund() when $default != null:
return $default(_that.amountPaise,_that.status);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  int amountPaise, @JsonKey(required: true)  String status)  $default,) {final _that = this;
switch (_that) {
case _BookingRefund():
return $default(_that.amountPaise,_that.status);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  int amountPaise, @JsonKey(required: true)  String status)?  $default,) {final _that = this;
switch (_that) {
case _BookingRefund() when $default != null:
return $default(_that.amountPaise,_that.status);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _BookingRefund implements BookingRefund {
  const _BookingRefund({@JsonKey(required: true) required this.amountPaise, @JsonKey(required: true) required this.status});
  factory _BookingRefund.fromJson(Map<String, dynamic> json) => _$BookingRefundFromJson(json);

@override@JsonKey(required: true) final  int amountPaise;
/// `pending`, `processed` or `failed`.
@override@JsonKey(required: true) final  String status;

/// Create a copy of BookingRefund
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$BookingRefundCopyWith<_BookingRefund> get copyWith => __$BookingRefundCopyWithImpl<_BookingRefund>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$BookingRefundToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _BookingRefund&&(identical(other.amountPaise, amountPaise) || other.amountPaise == amountPaise)&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,amountPaise,status);

@override
String toString() {
  return 'BookingRefund(amountPaise: $amountPaise, status: $status)';
}


}

/// @nodoc
abstract mixin class _$BookingRefundCopyWith<$Res> implements $BookingRefundCopyWith<$Res> {
  factory _$BookingRefundCopyWith(_BookingRefund value, $Res Function(_BookingRefund) _then) = __$BookingRefundCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) int amountPaise,@JsonKey(required: true) String status
});




}
/// @nodoc
class __$BookingRefundCopyWithImpl<$Res>
    implements _$BookingRefundCopyWith<$Res> {
  __$BookingRefundCopyWithImpl(this._self, this._then);

  final _BookingRefund _self;
  final $Res Function(_BookingRefund) _then;

/// Create a copy of BookingRefund
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? amountPaise = null,Object? status = null,}) {
  return _then(_BookingRefund(
amountPaise: null == amountPaise ? _self.amountPaise : amountPaise // ignore: cast_nullable_to_non_nullable
as int,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$Booking {

@JsonKey(required: true) String get id;/// `held`, `confirmed`, `active`, `overdue`, `completed`, `cancelled`, `expired` or `no_show`.
@JsonKey(required: true) String get status;@JsonKey(required: true) BookingDrawer get drawer;@JsonKey(required: true) BookingItem get itemModel;@JsonKey(required: true) String get assetCode;@JsonKey(required: true) DateTime get startsAt;@JsonKey(required: true) DateTime get endsAt;@JsonKey(required: true) int get durationMinutes;@JsonKey(required: true) int get pricePaise;@JsonKey(required: true) int get depositPaise;@JsonKey(required: true) int get totalPaise;@JsonKey(required: true) String get currency;/// While `held`: the payment must complete before this instant.
@JsonKey(required: true) DateTime? get holdExpiresAt;@JsonKey(required: true) bool get cancellable;@JsonKey(required: true) String? get cancelReason;@JsonKey(required: true) BookingPayment? get payment;@JsonKey(required: true) BookingRefund? get refund;@JsonKey(required: true) DateTime get createdAt;
/// Create a copy of Booking
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$BookingCopyWith<Booking> get copyWith => _$BookingCopyWithImpl<Booking>(this as Booking, _$identity);

  /// Serializes this Booking to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Booking&&(identical(other.id, id) || other.id == id)&&(identical(other.status, status) || other.status == status)&&(identical(other.drawer, drawer) || other.drawer == drawer)&&(identical(other.itemModel, itemModel) || other.itemModel == itemModel)&&(identical(other.assetCode, assetCode) || other.assetCode == assetCode)&&(identical(other.startsAt, startsAt) || other.startsAt == startsAt)&&(identical(other.endsAt, endsAt) || other.endsAt == endsAt)&&(identical(other.durationMinutes, durationMinutes) || other.durationMinutes == durationMinutes)&&(identical(other.pricePaise, pricePaise) || other.pricePaise == pricePaise)&&(identical(other.depositPaise, depositPaise) || other.depositPaise == depositPaise)&&(identical(other.totalPaise, totalPaise) || other.totalPaise == totalPaise)&&(identical(other.currency, currency) || other.currency == currency)&&(identical(other.holdExpiresAt, holdExpiresAt) || other.holdExpiresAt == holdExpiresAt)&&(identical(other.cancellable, cancellable) || other.cancellable == cancellable)&&(identical(other.cancelReason, cancelReason) || other.cancelReason == cancelReason)&&(identical(other.payment, payment) || other.payment == payment)&&(identical(other.refund, refund) || other.refund == refund)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,status,drawer,itemModel,assetCode,startsAt,endsAt,durationMinutes,pricePaise,depositPaise,totalPaise,currency,holdExpiresAt,cancellable,cancelReason,payment,refund,createdAt);

@override
String toString() {
  return 'Booking(id: $id, status: $status, drawer: $drawer, itemModel: $itemModel, assetCode: $assetCode, startsAt: $startsAt, endsAt: $endsAt, durationMinutes: $durationMinutes, pricePaise: $pricePaise, depositPaise: $depositPaise, totalPaise: $totalPaise, currency: $currency, holdExpiresAt: $holdExpiresAt, cancellable: $cancellable, cancelReason: $cancelReason, payment: $payment, refund: $refund, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class $BookingCopyWith<$Res>  {
  factory $BookingCopyWith(Booking value, $Res Function(Booking) _then) = _$BookingCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String id,@JsonKey(required: true) String status,@JsonKey(required: true) BookingDrawer drawer,@JsonKey(required: true) BookingItem itemModel,@JsonKey(required: true) String assetCode,@JsonKey(required: true) DateTime startsAt,@JsonKey(required: true) DateTime endsAt,@JsonKey(required: true) int durationMinutes,@JsonKey(required: true) int pricePaise,@JsonKey(required: true) int depositPaise,@JsonKey(required: true) int totalPaise,@JsonKey(required: true) String currency,@JsonKey(required: true) DateTime? holdExpiresAt,@JsonKey(required: true) bool cancellable,@JsonKey(required: true) String? cancelReason,@JsonKey(required: true) BookingPayment? payment,@JsonKey(required: true) BookingRefund? refund,@JsonKey(required: true) DateTime createdAt
});


$BookingDrawerCopyWith<$Res> get drawer;$BookingItemCopyWith<$Res> get itemModel;$BookingPaymentCopyWith<$Res>? get payment;$BookingRefundCopyWith<$Res>? get refund;

}
/// @nodoc
class _$BookingCopyWithImpl<$Res>
    implements $BookingCopyWith<$Res> {
  _$BookingCopyWithImpl(this._self, this._then);

  final Booking _self;
  final $Res Function(Booking) _then;

/// Create a copy of Booking
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? status = null,Object? drawer = null,Object? itemModel = null,Object? assetCode = null,Object? startsAt = null,Object? endsAt = null,Object? durationMinutes = null,Object? pricePaise = null,Object? depositPaise = null,Object? totalPaise = null,Object? currency = null,Object? holdExpiresAt = freezed,Object? cancellable = null,Object? cancelReason = freezed,Object? payment = freezed,Object? refund = freezed,Object? createdAt = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,drawer: null == drawer ? _self.drawer : drawer // ignore: cast_nullable_to_non_nullable
as BookingDrawer,itemModel: null == itemModel ? _self.itemModel : itemModel // ignore: cast_nullable_to_non_nullable
as BookingItem,assetCode: null == assetCode ? _self.assetCode : assetCode // ignore: cast_nullable_to_non_nullable
as String,startsAt: null == startsAt ? _self.startsAt : startsAt // ignore: cast_nullable_to_non_nullable
as DateTime,endsAt: null == endsAt ? _self.endsAt : endsAt // ignore: cast_nullable_to_non_nullable
as DateTime,durationMinutes: null == durationMinutes ? _self.durationMinutes : durationMinutes // ignore: cast_nullable_to_non_nullable
as int,pricePaise: null == pricePaise ? _self.pricePaise : pricePaise // ignore: cast_nullable_to_non_nullable
as int,depositPaise: null == depositPaise ? _self.depositPaise : depositPaise // ignore: cast_nullable_to_non_nullable
as int,totalPaise: null == totalPaise ? _self.totalPaise : totalPaise // ignore: cast_nullable_to_non_nullable
as int,currency: null == currency ? _self.currency : currency // ignore: cast_nullable_to_non_nullable
as String,holdExpiresAt: freezed == holdExpiresAt ? _self.holdExpiresAt : holdExpiresAt // ignore: cast_nullable_to_non_nullable
as DateTime?,cancellable: null == cancellable ? _self.cancellable : cancellable // ignore: cast_nullable_to_non_nullable
as bool,cancelReason: freezed == cancelReason ? _self.cancelReason : cancelReason // ignore: cast_nullable_to_non_nullable
as String?,payment: freezed == payment ? _self.payment : payment // ignore: cast_nullable_to_non_nullable
as BookingPayment?,refund: freezed == refund ? _self.refund : refund // ignore: cast_nullable_to_non_nullable
as BookingRefund?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}
/// Create a copy of Booking
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$BookingDrawerCopyWith<$Res> get drawer {
  
  return $BookingDrawerCopyWith<$Res>(_self.drawer, (value) {
    return _then(_self.copyWith(drawer: value));
  });
}/// Create a copy of Booking
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$BookingItemCopyWith<$Res> get itemModel {
  
  return $BookingItemCopyWith<$Res>(_self.itemModel, (value) {
    return _then(_self.copyWith(itemModel: value));
  });
}/// Create a copy of Booking
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$BookingPaymentCopyWith<$Res>? get payment {
    if (_self.payment == null) {
    return null;
  }

  return $BookingPaymentCopyWith<$Res>(_self.payment!, (value) {
    return _then(_self.copyWith(payment: value));
  });
}/// Create a copy of Booking
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$BookingRefundCopyWith<$Res>? get refund {
    if (_self.refund == null) {
    return null;
  }

  return $BookingRefundCopyWith<$Res>(_self.refund!, (value) {
    return _then(_self.copyWith(refund: value));
  });
}
}


/// Adds pattern-matching-related methods to [Booking].
extension BookingPatterns on Booking {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Booking value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Booking() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Booking value)  $default,){
final _that = this;
switch (_that) {
case _Booking():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Booking value)?  $default,){
final _that = this;
switch (_that) {
case _Booking() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String id, @JsonKey(required: true)  String status, @JsonKey(required: true)  BookingDrawer drawer, @JsonKey(required: true)  BookingItem itemModel, @JsonKey(required: true)  String assetCode, @JsonKey(required: true)  DateTime startsAt, @JsonKey(required: true)  DateTime endsAt, @JsonKey(required: true)  int durationMinutes, @JsonKey(required: true)  int pricePaise, @JsonKey(required: true)  int depositPaise, @JsonKey(required: true)  int totalPaise, @JsonKey(required: true)  String currency, @JsonKey(required: true)  DateTime? holdExpiresAt, @JsonKey(required: true)  bool cancellable, @JsonKey(required: true)  String? cancelReason, @JsonKey(required: true)  BookingPayment? payment, @JsonKey(required: true)  BookingRefund? refund, @JsonKey(required: true)  DateTime createdAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Booking() when $default != null:
return $default(_that.id,_that.status,_that.drawer,_that.itemModel,_that.assetCode,_that.startsAt,_that.endsAt,_that.durationMinutes,_that.pricePaise,_that.depositPaise,_that.totalPaise,_that.currency,_that.holdExpiresAt,_that.cancellable,_that.cancelReason,_that.payment,_that.refund,_that.createdAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String id, @JsonKey(required: true)  String status, @JsonKey(required: true)  BookingDrawer drawer, @JsonKey(required: true)  BookingItem itemModel, @JsonKey(required: true)  String assetCode, @JsonKey(required: true)  DateTime startsAt, @JsonKey(required: true)  DateTime endsAt, @JsonKey(required: true)  int durationMinutes, @JsonKey(required: true)  int pricePaise, @JsonKey(required: true)  int depositPaise, @JsonKey(required: true)  int totalPaise, @JsonKey(required: true)  String currency, @JsonKey(required: true)  DateTime? holdExpiresAt, @JsonKey(required: true)  bool cancellable, @JsonKey(required: true)  String? cancelReason, @JsonKey(required: true)  BookingPayment? payment, @JsonKey(required: true)  BookingRefund? refund, @JsonKey(required: true)  DateTime createdAt)  $default,) {final _that = this;
switch (_that) {
case _Booking():
return $default(_that.id,_that.status,_that.drawer,_that.itemModel,_that.assetCode,_that.startsAt,_that.endsAt,_that.durationMinutes,_that.pricePaise,_that.depositPaise,_that.totalPaise,_that.currency,_that.holdExpiresAt,_that.cancellable,_that.cancelReason,_that.payment,_that.refund,_that.createdAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String id, @JsonKey(required: true)  String status, @JsonKey(required: true)  BookingDrawer drawer, @JsonKey(required: true)  BookingItem itemModel, @JsonKey(required: true)  String assetCode, @JsonKey(required: true)  DateTime startsAt, @JsonKey(required: true)  DateTime endsAt, @JsonKey(required: true)  int durationMinutes, @JsonKey(required: true)  int pricePaise, @JsonKey(required: true)  int depositPaise, @JsonKey(required: true)  int totalPaise, @JsonKey(required: true)  String currency, @JsonKey(required: true)  DateTime? holdExpiresAt, @JsonKey(required: true)  bool cancellable, @JsonKey(required: true)  String? cancelReason, @JsonKey(required: true)  BookingPayment? payment, @JsonKey(required: true)  BookingRefund? refund, @JsonKey(required: true)  DateTime createdAt)?  $default,) {final _that = this;
switch (_that) {
case _Booking() when $default != null:
return $default(_that.id,_that.status,_that.drawer,_that.itemModel,_that.assetCode,_that.startsAt,_that.endsAt,_that.durationMinutes,_that.pricePaise,_that.depositPaise,_that.totalPaise,_that.currency,_that.holdExpiresAt,_that.cancellable,_that.cancelReason,_that.payment,_that.refund,_that.createdAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Booking implements Booking {
  const _Booking({@JsonKey(required: true) required this.id, @JsonKey(required: true) required this.status, @JsonKey(required: true) required this.drawer, @JsonKey(required: true) required this.itemModel, @JsonKey(required: true) required this.assetCode, @JsonKey(required: true) required this.startsAt, @JsonKey(required: true) required this.endsAt, @JsonKey(required: true) required this.durationMinutes, @JsonKey(required: true) required this.pricePaise, @JsonKey(required: true) required this.depositPaise, @JsonKey(required: true) required this.totalPaise, @JsonKey(required: true) required this.currency, @JsonKey(required: true) required this.holdExpiresAt, @JsonKey(required: true) required this.cancellable, @JsonKey(required: true) required this.cancelReason, @JsonKey(required: true) required this.payment, @JsonKey(required: true) required this.refund, @JsonKey(required: true) required this.createdAt});
  factory _Booking.fromJson(Map<String, dynamic> json) => _$BookingFromJson(json);

@override@JsonKey(required: true) final  String id;
/// `held`, `confirmed`, `active`, `overdue`, `completed`, `cancelled`, `expired` or `no_show`.
@override@JsonKey(required: true) final  String status;
@override@JsonKey(required: true) final  BookingDrawer drawer;
@override@JsonKey(required: true) final  BookingItem itemModel;
@override@JsonKey(required: true) final  String assetCode;
@override@JsonKey(required: true) final  DateTime startsAt;
@override@JsonKey(required: true) final  DateTime endsAt;
@override@JsonKey(required: true) final  int durationMinutes;
@override@JsonKey(required: true) final  int pricePaise;
@override@JsonKey(required: true) final  int depositPaise;
@override@JsonKey(required: true) final  int totalPaise;
@override@JsonKey(required: true) final  String currency;
/// While `held`: the payment must complete before this instant.
@override@JsonKey(required: true) final  DateTime? holdExpiresAt;
@override@JsonKey(required: true) final  bool cancellable;
@override@JsonKey(required: true) final  String? cancelReason;
@override@JsonKey(required: true) final  BookingPayment? payment;
@override@JsonKey(required: true) final  BookingRefund? refund;
@override@JsonKey(required: true) final  DateTime createdAt;

/// Create a copy of Booking
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$BookingCopyWith<_Booking> get copyWith => __$BookingCopyWithImpl<_Booking>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$BookingToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Booking&&(identical(other.id, id) || other.id == id)&&(identical(other.status, status) || other.status == status)&&(identical(other.drawer, drawer) || other.drawer == drawer)&&(identical(other.itemModel, itemModel) || other.itemModel == itemModel)&&(identical(other.assetCode, assetCode) || other.assetCode == assetCode)&&(identical(other.startsAt, startsAt) || other.startsAt == startsAt)&&(identical(other.endsAt, endsAt) || other.endsAt == endsAt)&&(identical(other.durationMinutes, durationMinutes) || other.durationMinutes == durationMinutes)&&(identical(other.pricePaise, pricePaise) || other.pricePaise == pricePaise)&&(identical(other.depositPaise, depositPaise) || other.depositPaise == depositPaise)&&(identical(other.totalPaise, totalPaise) || other.totalPaise == totalPaise)&&(identical(other.currency, currency) || other.currency == currency)&&(identical(other.holdExpiresAt, holdExpiresAt) || other.holdExpiresAt == holdExpiresAt)&&(identical(other.cancellable, cancellable) || other.cancellable == cancellable)&&(identical(other.cancelReason, cancelReason) || other.cancelReason == cancelReason)&&(identical(other.payment, payment) || other.payment == payment)&&(identical(other.refund, refund) || other.refund == refund)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,status,drawer,itemModel,assetCode,startsAt,endsAt,durationMinutes,pricePaise,depositPaise,totalPaise,currency,holdExpiresAt,cancellable,cancelReason,payment,refund,createdAt);

@override
String toString() {
  return 'Booking(id: $id, status: $status, drawer: $drawer, itemModel: $itemModel, assetCode: $assetCode, startsAt: $startsAt, endsAt: $endsAt, durationMinutes: $durationMinutes, pricePaise: $pricePaise, depositPaise: $depositPaise, totalPaise: $totalPaise, currency: $currency, holdExpiresAt: $holdExpiresAt, cancellable: $cancellable, cancelReason: $cancelReason, payment: $payment, refund: $refund, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class _$BookingCopyWith<$Res> implements $BookingCopyWith<$Res> {
  factory _$BookingCopyWith(_Booking value, $Res Function(_Booking) _then) = __$BookingCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String id,@JsonKey(required: true) String status,@JsonKey(required: true) BookingDrawer drawer,@JsonKey(required: true) BookingItem itemModel,@JsonKey(required: true) String assetCode,@JsonKey(required: true) DateTime startsAt,@JsonKey(required: true) DateTime endsAt,@JsonKey(required: true) int durationMinutes,@JsonKey(required: true) int pricePaise,@JsonKey(required: true) int depositPaise,@JsonKey(required: true) int totalPaise,@JsonKey(required: true) String currency,@JsonKey(required: true) DateTime? holdExpiresAt,@JsonKey(required: true) bool cancellable,@JsonKey(required: true) String? cancelReason,@JsonKey(required: true) BookingPayment? payment,@JsonKey(required: true) BookingRefund? refund,@JsonKey(required: true) DateTime createdAt
});


@override $BookingDrawerCopyWith<$Res> get drawer;@override $BookingItemCopyWith<$Res> get itemModel;@override $BookingPaymentCopyWith<$Res>? get payment;@override $BookingRefundCopyWith<$Res>? get refund;

}
/// @nodoc
class __$BookingCopyWithImpl<$Res>
    implements _$BookingCopyWith<$Res> {
  __$BookingCopyWithImpl(this._self, this._then);

  final _Booking _self;
  final $Res Function(_Booking) _then;

/// Create a copy of Booking
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? status = null,Object? drawer = null,Object? itemModel = null,Object? assetCode = null,Object? startsAt = null,Object? endsAt = null,Object? durationMinutes = null,Object? pricePaise = null,Object? depositPaise = null,Object? totalPaise = null,Object? currency = null,Object? holdExpiresAt = freezed,Object? cancellable = null,Object? cancelReason = freezed,Object? payment = freezed,Object? refund = freezed,Object? createdAt = null,}) {
  return _then(_Booking(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,drawer: null == drawer ? _self.drawer : drawer // ignore: cast_nullable_to_non_nullable
as BookingDrawer,itemModel: null == itemModel ? _self.itemModel : itemModel // ignore: cast_nullable_to_non_nullable
as BookingItem,assetCode: null == assetCode ? _self.assetCode : assetCode // ignore: cast_nullable_to_non_nullable
as String,startsAt: null == startsAt ? _self.startsAt : startsAt // ignore: cast_nullable_to_non_nullable
as DateTime,endsAt: null == endsAt ? _self.endsAt : endsAt // ignore: cast_nullable_to_non_nullable
as DateTime,durationMinutes: null == durationMinutes ? _self.durationMinutes : durationMinutes // ignore: cast_nullable_to_non_nullable
as int,pricePaise: null == pricePaise ? _self.pricePaise : pricePaise // ignore: cast_nullable_to_non_nullable
as int,depositPaise: null == depositPaise ? _self.depositPaise : depositPaise // ignore: cast_nullable_to_non_nullable
as int,totalPaise: null == totalPaise ? _self.totalPaise : totalPaise // ignore: cast_nullable_to_non_nullable
as int,currency: null == currency ? _self.currency : currency // ignore: cast_nullable_to_non_nullable
as String,holdExpiresAt: freezed == holdExpiresAt ? _self.holdExpiresAt : holdExpiresAt // ignore: cast_nullable_to_non_nullable
as DateTime?,cancellable: null == cancellable ? _self.cancellable : cancellable // ignore: cast_nullable_to_non_nullable
as bool,cancelReason: freezed == cancelReason ? _self.cancelReason : cancelReason // ignore: cast_nullable_to_non_nullable
as String?,payment: freezed == payment ? _self.payment : payment // ignore: cast_nullable_to_non_nullable
as BookingPayment?,refund: freezed == refund ? _self.refund : refund // ignore: cast_nullable_to_non_nullable
as BookingRefund?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}

/// Create a copy of Booking
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$BookingDrawerCopyWith<$Res> get drawer {
  
  return $BookingDrawerCopyWith<$Res>(_self.drawer, (value) {
    return _then(_self.copyWith(drawer: value));
  });
}/// Create a copy of Booking
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$BookingItemCopyWith<$Res> get itemModel {
  
  return $BookingItemCopyWith<$Res>(_self.itemModel, (value) {
    return _then(_self.copyWith(itemModel: value));
  });
}/// Create a copy of Booking
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$BookingPaymentCopyWith<$Res>? get payment {
    if (_self.payment == null) {
    return null;
  }

  return $BookingPaymentCopyWith<$Res>(_self.payment!, (value) {
    return _then(_self.copyWith(payment: value));
  });
}/// Create a copy of Booking
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$BookingRefundCopyWith<$Res>? get refund {
    if (_self.refund == null) {
    return null;
  }

  return $BookingRefundCopyWith<$Res>(_self.refund!, (value) {
    return _then(_self.copyWith(refund: value));
  });
}
}


/// @nodoc
mixin _$PaymentOrder {

@JsonKey(required: true) String get provider;@JsonKey(required: true) String get orderId;@JsonKey(required: true) int get amountPaise;@JsonKey(required: true) String get currency;@JsonKey(required: true) DateTime? get holdExpiresAt;
/// Create a copy of PaymentOrder
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PaymentOrderCopyWith<PaymentOrder> get copyWith => _$PaymentOrderCopyWithImpl<PaymentOrder>(this as PaymentOrder, _$identity);

  /// Serializes this PaymentOrder to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PaymentOrder&&(identical(other.provider, provider) || other.provider == provider)&&(identical(other.orderId, orderId) || other.orderId == orderId)&&(identical(other.amountPaise, amountPaise) || other.amountPaise == amountPaise)&&(identical(other.currency, currency) || other.currency == currency)&&(identical(other.holdExpiresAt, holdExpiresAt) || other.holdExpiresAt == holdExpiresAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,provider,orderId,amountPaise,currency,holdExpiresAt);

@override
String toString() {
  return 'PaymentOrder(provider: $provider, orderId: $orderId, amountPaise: $amountPaise, currency: $currency, holdExpiresAt: $holdExpiresAt)';
}


}

/// @nodoc
abstract mixin class $PaymentOrderCopyWith<$Res>  {
  factory $PaymentOrderCopyWith(PaymentOrder value, $Res Function(PaymentOrder) _then) = _$PaymentOrderCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String provider,@JsonKey(required: true) String orderId,@JsonKey(required: true) int amountPaise,@JsonKey(required: true) String currency,@JsonKey(required: true) DateTime? holdExpiresAt
});




}
/// @nodoc
class _$PaymentOrderCopyWithImpl<$Res>
    implements $PaymentOrderCopyWith<$Res> {
  _$PaymentOrderCopyWithImpl(this._self, this._then);

  final PaymentOrder _self;
  final $Res Function(PaymentOrder) _then;

/// Create a copy of PaymentOrder
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? provider = null,Object? orderId = null,Object? amountPaise = null,Object? currency = null,Object? holdExpiresAt = freezed,}) {
  return _then(_self.copyWith(
provider: null == provider ? _self.provider : provider // ignore: cast_nullable_to_non_nullable
as String,orderId: null == orderId ? _self.orderId : orderId // ignore: cast_nullable_to_non_nullable
as String,amountPaise: null == amountPaise ? _self.amountPaise : amountPaise // ignore: cast_nullable_to_non_nullable
as int,currency: null == currency ? _self.currency : currency // ignore: cast_nullable_to_non_nullable
as String,holdExpiresAt: freezed == holdExpiresAt ? _self.holdExpiresAt : holdExpiresAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [PaymentOrder].
extension PaymentOrderPatterns on PaymentOrder {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PaymentOrder value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PaymentOrder() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PaymentOrder value)  $default,){
final _that = this;
switch (_that) {
case _PaymentOrder():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PaymentOrder value)?  $default,){
final _that = this;
switch (_that) {
case _PaymentOrder() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String provider, @JsonKey(required: true)  String orderId, @JsonKey(required: true)  int amountPaise, @JsonKey(required: true)  String currency, @JsonKey(required: true)  DateTime? holdExpiresAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PaymentOrder() when $default != null:
return $default(_that.provider,_that.orderId,_that.amountPaise,_that.currency,_that.holdExpiresAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String provider, @JsonKey(required: true)  String orderId, @JsonKey(required: true)  int amountPaise, @JsonKey(required: true)  String currency, @JsonKey(required: true)  DateTime? holdExpiresAt)  $default,) {final _that = this;
switch (_that) {
case _PaymentOrder():
return $default(_that.provider,_that.orderId,_that.amountPaise,_that.currency,_that.holdExpiresAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String provider, @JsonKey(required: true)  String orderId, @JsonKey(required: true)  int amountPaise, @JsonKey(required: true)  String currency, @JsonKey(required: true)  DateTime? holdExpiresAt)?  $default,) {final _that = this;
switch (_that) {
case _PaymentOrder() when $default != null:
return $default(_that.provider,_that.orderId,_that.amountPaise,_that.currency,_that.holdExpiresAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PaymentOrder implements PaymentOrder {
  const _PaymentOrder({@JsonKey(required: true) required this.provider, @JsonKey(required: true) required this.orderId, @JsonKey(required: true) required this.amountPaise, @JsonKey(required: true) required this.currency, @JsonKey(required: true) required this.holdExpiresAt});
  factory _PaymentOrder.fromJson(Map<String, dynamic> json) => _$PaymentOrderFromJson(json);

@override@JsonKey(required: true) final  String provider;
@override@JsonKey(required: true) final  String orderId;
@override@JsonKey(required: true) final  int amountPaise;
@override@JsonKey(required: true) final  String currency;
@override@JsonKey(required: true) final  DateTime? holdExpiresAt;

/// Create a copy of PaymentOrder
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PaymentOrderCopyWith<_PaymentOrder> get copyWith => __$PaymentOrderCopyWithImpl<_PaymentOrder>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PaymentOrderToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PaymentOrder&&(identical(other.provider, provider) || other.provider == provider)&&(identical(other.orderId, orderId) || other.orderId == orderId)&&(identical(other.amountPaise, amountPaise) || other.amountPaise == amountPaise)&&(identical(other.currency, currency) || other.currency == currency)&&(identical(other.holdExpiresAt, holdExpiresAt) || other.holdExpiresAt == holdExpiresAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,provider,orderId,amountPaise,currency,holdExpiresAt);

@override
String toString() {
  return 'PaymentOrder(provider: $provider, orderId: $orderId, amountPaise: $amountPaise, currency: $currency, holdExpiresAt: $holdExpiresAt)';
}


}

/// @nodoc
abstract mixin class _$PaymentOrderCopyWith<$Res> implements $PaymentOrderCopyWith<$Res> {
  factory _$PaymentOrderCopyWith(_PaymentOrder value, $Res Function(_PaymentOrder) _then) = __$PaymentOrderCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String provider,@JsonKey(required: true) String orderId,@JsonKey(required: true) int amountPaise,@JsonKey(required: true) String currency,@JsonKey(required: true) DateTime? holdExpiresAt
});




}
/// @nodoc
class __$PaymentOrderCopyWithImpl<$Res>
    implements _$PaymentOrderCopyWith<$Res> {
  __$PaymentOrderCopyWithImpl(this._self, this._then);

  final _PaymentOrder _self;
  final $Res Function(_PaymentOrder) _then;

/// Create a copy of PaymentOrder
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? provider = null,Object? orderId = null,Object? amountPaise = null,Object? currency = null,Object? holdExpiresAt = freezed,}) {
  return _then(_PaymentOrder(
provider: null == provider ? _self.provider : provider // ignore: cast_nullable_to_non_nullable
as String,orderId: null == orderId ? _self.orderId : orderId // ignore: cast_nullable_to_non_nullable
as String,amountPaise: null == amountPaise ? _self.amountPaise : amountPaise // ignore: cast_nullable_to_non_nullable
as int,currency: null == currency ? _self.currency : currency // ignore: cast_nullable_to_non_nullable
as String,holdExpiresAt: freezed == holdExpiresAt ? _self.holdExpiresAt : holdExpiresAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}


/// @nodoc
mixin _$SimulatedCheckout {

@JsonKey(required: true) String get orderId;@JsonKey(required: true) String get paymentId;@JsonKey(required: true) String get signature;
/// Create a copy of SimulatedCheckout
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SimulatedCheckoutCopyWith<SimulatedCheckout> get copyWith => _$SimulatedCheckoutCopyWithImpl<SimulatedCheckout>(this as SimulatedCheckout, _$identity);

  /// Serializes this SimulatedCheckout to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SimulatedCheckout&&(identical(other.orderId, orderId) || other.orderId == orderId)&&(identical(other.paymentId, paymentId) || other.paymentId == paymentId)&&(identical(other.signature, signature) || other.signature == signature));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,orderId,paymentId,signature);

@override
String toString() {
  return 'SimulatedCheckout(orderId: $orderId, paymentId: $paymentId, signature: $signature)';
}


}

/// @nodoc
abstract mixin class $SimulatedCheckoutCopyWith<$Res>  {
  factory $SimulatedCheckoutCopyWith(SimulatedCheckout value, $Res Function(SimulatedCheckout) _then) = _$SimulatedCheckoutCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String orderId,@JsonKey(required: true) String paymentId,@JsonKey(required: true) String signature
});




}
/// @nodoc
class _$SimulatedCheckoutCopyWithImpl<$Res>
    implements $SimulatedCheckoutCopyWith<$Res> {
  _$SimulatedCheckoutCopyWithImpl(this._self, this._then);

  final SimulatedCheckout _self;
  final $Res Function(SimulatedCheckout) _then;

/// Create a copy of SimulatedCheckout
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? orderId = null,Object? paymentId = null,Object? signature = null,}) {
  return _then(_self.copyWith(
orderId: null == orderId ? _self.orderId : orderId // ignore: cast_nullable_to_non_nullable
as String,paymentId: null == paymentId ? _self.paymentId : paymentId // ignore: cast_nullable_to_non_nullable
as String,signature: null == signature ? _self.signature : signature // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [SimulatedCheckout].
extension SimulatedCheckoutPatterns on SimulatedCheckout {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SimulatedCheckout value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SimulatedCheckout() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SimulatedCheckout value)  $default,){
final _that = this;
switch (_that) {
case _SimulatedCheckout():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SimulatedCheckout value)?  $default,){
final _that = this;
switch (_that) {
case _SimulatedCheckout() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String orderId, @JsonKey(required: true)  String paymentId, @JsonKey(required: true)  String signature)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SimulatedCheckout() when $default != null:
return $default(_that.orderId,_that.paymentId,_that.signature);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String orderId, @JsonKey(required: true)  String paymentId, @JsonKey(required: true)  String signature)  $default,) {final _that = this;
switch (_that) {
case _SimulatedCheckout():
return $default(_that.orderId,_that.paymentId,_that.signature);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String orderId, @JsonKey(required: true)  String paymentId, @JsonKey(required: true)  String signature)?  $default,) {final _that = this;
switch (_that) {
case _SimulatedCheckout() when $default != null:
return $default(_that.orderId,_that.paymentId,_that.signature);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SimulatedCheckout implements SimulatedCheckout {
  const _SimulatedCheckout({@JsonKey(required: true) required this.orderId, @JsonKey(required: true) required this.paymentId, @JsonKey(required: true) required this.signature});
  factory _SimulatedCheckout.fromJson(Map<String, dynamic> json) => _$SimulatedCheckoutFromJson(json);

@override@JsonKey(required: true) final  String orderId;
@override@JsonKey(required: true) final  String paymentId;
@override@JsonKey(required: true) final  String signature;

/// Create a copy of SimulatedCheckout
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SimulatedCheckoutCopyWith<_SimulatedCheckout> get copyWith => __$SimulatedCheckoutCopyWithImpl<_SimulatedCheckout>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SimulatedCheckoutToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SimulatedCheckout&&(identical(other.orderId, orderId) || other.orderId == orderId)&&(identical(other.paymentId, paymentId) || other.paymentId == paymentId)&&(identical(other.signature, signature) || other.signature == signature));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,orderId,paymentId,signature);

@override
String toString() {
  return 'SimulatedCheckout(orderId: $orderId, paymentId: $paymentId, signature: $signature)';
}


}

/// @nodoc
abstract mixin class _$SimulatedCheckoutCopyWith<$Res> implements $SimulatedCheckoutCopyWith<$Res> {
  factory _$SimulatedCheckoutCopyWith(_SimulatedCheckout value, $Res Function(_SimulatedCheckout) _then) = __$SimulatedCheckoutCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String orderId,@JsonKey(required: true) String paymentId,@JsonKey(required: true) String signature
});




}
/// @nodoc
class __$SimulatedCheckoutCopyWithImpl<$Res>
    implements _$SimulatedCheckoutCopyWith<$Res> {
  __$SimulatedCheckoutCopyWithImpl(this._self, this._then);

  final _SimulatedCheckout _self;
  final $Res Function(_SimulatedCheckout) _then;

/// Create a copy of SimulatedCheckout
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? orderId = null,Object? paymentId = null,Object? signature = null,}) {
  return _then(_SimulatedCheckout(
orderId: null == orderId ? _self.orderId : orderId // ignore: cast_nullable_to_non_nullable
as String,paymentId: null == paymentId ? _self.paymentId : paymentId // ignore: cast_nullable_to_non_nullable
as String,signature: null == signature ? _self.signature : signature // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$ConfirmPaymentRequest {

@JsonKey(required: true) String get orderId;@JsonKey(required: true) String get paymentId;@JsonKey(required: true) String get signature;
/// Create a copy of ConfirmPaymentRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ConfirmPaymentRequestCopyWith<ConfirmPaymentRequest> get copyWith => _$ConfirmPaymentRequestCopyWithImpl<ConfirmPaymentRequest>(this as ConfirmPaymentRequest, _$identity);

  /// Serializes this ConfirmPaymentRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ConfirmPaymentRequest&&(identical(other.orderId, orderId) || other.orderId == orderId)&&(identical(other.paymentId, paymentId) || other.paymentId == paymentId)&&(identical(other.signature, signature) || other.signature == signature));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,orderId,paymentId,signature);

@override
String toString() {
  return 'ConfirmPaymentRequest(orderId: $orderId, paymentId: $paymentId, signature: $signature)';
}


}

/// @nodoc
abstract mixin class $ConfirmPaymentRequestCopyWith<$Res>  {
  factory $ConfirmPaymentRequestCopyWith(ConfirmPaymentRequest value, $Res Function(ConfirmPaymentRequest) _then) = _$ConfirmPaymentRequestCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String orderId,@JsonKey(required: true) String paymentId,@JsonKey(required: true) String signature
});




}
/// @nodoc
class _$ConfirmPaymentRequestCopyWithImpl<$Res>
    implements $ConfirmPaymentRequestCopyWith<$Res> {
  _$ConfirmPaymentRequestCopyWithImpl(this._self, this._then);

  final ConfirmPaymentRequest _self;
  final $Res Function(ConfirmPaymentRequest) _then;

/// Create a copy of ConfirmPaymentRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? orderId = null,Object? paymentId = null,Object? signature = null,}) {
  return _then(_self.copyWith(
orderId: null == orderId ? _self.orderId : orderId // ignore: cast_nullable_to_non_nullable
as String,paymentId: null == paymentId ? _self.paymentId : paymentId // ignore: cast_nullable_to_non_nullable
as String,signature: null == signature ? _self.signature : signature // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [ConfirmPaymentRequest].
extension ConfirmPaymentRequestPatterns on ConfirmPaymentRequest {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ConfirmPaymentRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ConfirmPaymentRequest() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ConfirmPaymentRequest value)  $default,){
final _that = this;
switch (_that) {
case _ConfirmPaymentRequest():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ConfirmPaymentRequest value)?  $default,){
final _that = this;
switch (_that) {
case _ConfirmPaymentRequest() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String orderId, @JsonKey(required: true)  String paymentId, @JsonKey(required: true)  String signature)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ConfirmPaymentRequest() when $default != null:
return $default(_that.orderId,_that.paymentId,_that.signature);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String orderId, @JsonKey(required: true)  String paymentId, @JsonKey(required: true)  String signature)  $default,) {final _that = this;
switch (_that) {
case _ConfirmPaymentRequest():
return $default(_that.orderId,_that.paymentId,_that.signature);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String orderId, @JsonKey(required: true)  String paymentId, @JsonKey(required: true)  String signature)?  $default,) {final _that = this;
switch (_that) {
case _ConfirmPaymentRequest() when $default != null:
return $default(_that.orderId,_that.paymentId,_that.signature);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ConfirmPaymentRequest implements ConfirmPaymentRequest {
  const _ConfirmPaymentRequest({@JsonKey(required: true) required this.orderId, @JsonKey(required: true) required this.paymentId, @JsonKey(required: true) required this.signature});
  factory _ConfirmPaymentRequest.fromJson(Map<String, dynamic> json) => _$ConfirmPaymentRequestFromJson(json);

@override@JsonKey(required: true) final  String orderId;
@override@JsonKey(required: true) final  String paymentId;
@override@JsonKey(required: true) final  String signature;

/// Create a copy of ConfirmPaymentRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ConfirmPaymentRequestCopyWith<_ConfirmPaymentRequest> get copyWith => __$ConfirmPaymentRequestCopyWithImpl<_ConfirmPaymentRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ConfirmPaymentRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ConfirmPaymentRequest&&(identical(other.orderId, orderId) || other.orderId == orderId)&&(identical(other.paymentId, paymentId) || other.paymentId == paymentId)&&(identical(other.signature, signature) || other.signature == signature));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,orderId,paymentId,signature);

@override
String toString() {
  return 'ConfirmPaymentRequest(orderId: $orderId, paymentId: $paymentId, signature: $signature)';
}


}

/// @nodoc
abstract mixin class _$ConfirmPaymentRequestCopyWith<$Res> implements $ConfirmPaymentRequestCopyWith<$Res> {
  factory _$ConfirmPaymentRequestCopyWith(_ConfirmPaymentRequest value, $Res Function(_ConfirmPaymentRequest) _then) = __$ConfirmPaymentRequestCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String orderId,@JsonKey(required: true) String paymentId,@JsonKey(required: true) String signature
});




}
/// @nodoc
class __$ConfirmPaymentRequestCopyWithImpl<$Res>
    implements _$ConfirmPaymentRequestCopyWith<$Res> {
  __$ConfirmPaymentRequestCopyWithImpl(this._self, this._then);

  final _ConfirmPaymentRequest _self;
  final $Res Function(_ConfirmPaymentRequest) _then;

/// Create a copy of ConfirmPaymentRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? orderId = null,Object? paymentId = null,Object? signature = null,}) {
  return _then(_ConfirmPaymentRequest(
orderId: null == orderId ? _self.orderId : orderId // ignore: cast_nullable_to_non_nullable
as String,paymentId: null == paymentId ? _self.paymentId : paymentId // ignore: cast_nullable_to_non_nullable
as String,signature: null == signature ? _self.signature : signature // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$ExtendBookingRequest {

@JsonKey(required: true) int get extraMinutes;
/// Create a copy of ExtendBookingRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ExtendBookingRequestCopyWith<ExtendBookingRequest> get copyWith => _$ExtendBookingRequestCopyWithImpl<ExtendBookingRequest>(this as ExtendBookingRequest, _$identity);

  /// Serializes this ExtendBookingRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ExtendBookingRequest&&(identical(other.extraMinutes, extraMinutes) || other.extraMinutes == extraMinutes));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,extraMinutes);

@override
String toString() {
  return 'ExtendBookingRequest(extraMinutes: $extraMinutes)';
}


}

/// @nodoc
abstract mixin class $ExtendBookingRequestCopyWith<$Res>  {
  factory $ExtendBookingRequestCopyWith(ExtendBookingRequest value, $Res Function(ExtendBookingRequest) _then) = _$ExtendBookingRequestCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) int extraMinutes
});




}
/// @nodoc
class _$ExtendBookingRequestCopyWithImpl<$Res>
    implements $ExtendBookingRequestCopyWith<$Res> {
  _$ExtendBookingRequestCopyWithImpl(this._self, this._then);

  final ExtendBookingRequest _self;
  final $Res Function(ExtendBookingRequest) _then;

/// Create a copy of ExtendBookingRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? extraMinutes = null,}) {
  return _then(_self.copyWith(
extraMinutes: null == extraMinutes ? _self.extraMinutes : extraMinutes // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [ExtendBookingRequest].
extension ExtendBookingRequestPatterns on ExtendBookingRequest {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ExtendBookingRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ExtendBookingRequest() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ExtendBookingRequest value)  $default,){
final _that = this;
switch (_that) {
case _ExtendBookingRequest():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ExtendBookingRequest value)?  $default,){
final _that = this;
switch (_that) {
case _ExtendBookingRequest() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  int extraMinutes)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ExtendBookingRequest() when $default != null:
return $default(_that.extraMinutes);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  int extraMinutes)  $default,) {final _that = this;
switch (_that) {
case _ExtendBookingRequest():
return $default(_that.extraMinutes);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  int extraMinutes)?  $default,) {final _that = this;
switch (_that) {
case _ExtendBookingRequest() when $default != null:
return $default(_that.extraMinutes);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ExtendBookingRequest implements ExtendBookingRequest {
  const _ExtendBookingRequest({@JsonKey(required: true) required this.extraMinutes});
  factory _ExtendBookingRequest.fromJson(Map<String, dynamic> json) => _$ExtendBookingRequestFromJson(json);

@override@JsonKey(required: true) final  int extraMinutes;

/// Create a copy of ExtendBookingRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ExtendBookingRequestCopyWith<_ExtendBookingRequest> get copyWith => __$ExtendBookingRequestCopyWithImpl<_ExtendBookingRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ExtendBookingRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ExtendBookingRequest&&(identical(other.extraMinutes, extraMinutes) || other.extraMinutes == extraMinutes));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,extraMinutes);

@override
String toString() {
  return 'ExtendBookingRequest(extraMinutes: $extraMinutes)';
}


}

/// @nodoc
abstract mixin class _$ExtendBookingRequestCopyWith<$Res> implements $ExtendBookingRequestCopyWith<$Res> {
  factory _$ExtendBookingRequestCopyWith(_ExtendBookingRequest value, $Res Function(_ExtendBookingRequest) _then) = __$ExtendBookingRequestCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) int extraMinutes
});




}
/// @nodoc
class __$ExtendBookingRequestCopyWithImpl<$Res>
    implements _$ExtendBookingRequestCopyWith<$Res> {
  __$ExtendBookingRequestCopyWithImpl(this._self, this._then);

  final _ExtendBookingRequest _self;
  final $Res Function(_ExtendBookingRequest) _then;

/// Create a copy of ExtendBookingRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? extraMinutes = null,}) {
  return _then(_ExtendBookingRequest(
extraMinutes: null == extraMinutes ? _self.extraMinutes : extraMinutes // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$Extension {

@JsonKey(required: true) String get id;@JsonKey(required: true) int get extraMinutes;@JsonKey(required: true) int get pricePaise;@JsonKey(required: true) DateTime get newEndsAt;@JsonKey(required: true) String get orderId;@JsonKey(required: true) String get provider;
/// Create a copy of Extension
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ExtensionCopyWith<Extension> get copyWith => _$ExtensionCopyWithImpl<Extension>(this as Extension, _$identity);

  /// Serializes this Extension to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Extension&&(identical(other.id, id) || other.id == id)&&(identical(other.extraMinutes, extraMinutes) || other.extraMinutes == extraMinutes)&&(identical(other.pricePaise, pricePaise) || other.pricePaise == pricePaise)&&(identical(other.newEndsAt, newEndsAt) || other.newEndsAt == newEndsAt)&&(identical(other.orderId, orderId) || other.orderId == orderId)&&(identical(other.provider, provider) || other.provider == provider));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,extraMinutes,pricePaise,newEndsAt,orderId,provider);

@override
String toString() {
  return 'Extension(id: $id, extraMinutes: $extraMinutes, pricePaise: $pricePaise, newEndsAt: $newEndsAt, orderId: $orderId, provider: $provider)';
}


}

/// @nodoc
abstract mixin class $ExtensionCopyWith<$Res>  {
  factory $ExtensionCopyWith(Extension value, $Res Function(Extension) _then) = _$ExtensionCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String id,@JsonKey(required: true) int extraMinutes,@JsonKey(required: true) int pricePaise,@JsonKey(required: true) DateTime newEndsAt,@JsonKey(required: true) String orderId,@JsonKey(required: true) String provider
});




}
/// @nodoc
class _$ExtensionCopyWithImpl<$Res>
    implements $ExtensionCopyWith<$Res> {
  _$ExtensionCopyWithImpl(this._self, this._then);

  final Extension _self;
  final $Res Function(Extension) _then;

/// Create a copy of Extension
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? extraMinutes = null,Object? pricePaise = null,Object? newEndsAt = null,Object? orderId = null,Object? provider = null,}) {
  return _then(_self.copyWith(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,extraMinutes: null == extraMinutes ? _self.extraMinutes : extraMinutes // ignore: cast_nullable_to_non_nullable
as int,pricePaise: null == pricePaise ? _self.pricePaise : pricePaise // ignore: cast_nullable_to_non_nullable
as int,newEndsAt: null == newEndsAt ? _self.newEndsAt : newEndsAt // ignore: cast_nullable_to_non_nullable
as DateTime,orderId: null == orderId ? _self.orderId : orderId // ignore: cast_nullable_to_non_nullable
as String,provider: null == provider ? _self.provider : provider // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [Extension].
extension ExtensionPatterns on Extension {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Extension value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Extension() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Extension value)  $default,){
final _that = this;
switch (_that) {
case _Extension():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Extension value)?  $default,){
final _that = this;
switch (_that) {
case _Extension() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String id, @JsonKey(required: true)  int extraMinutes, @JsonKey(required: true)  int pricePaise, @JsonKey(required: true)  DateTime newEndsAt, @JsonKey(required: true)  String orderId, @JsonKey(required: true)  String provider)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Extension() when $default != null:
return $default(_that.id,_that.extraMinutes,_that.pricePaise,_that.newEndsAt,_that.orderId,_that.provider);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String id, @JsonKey(required: true)  int extraMinutes, @JsonKey(required: true)  int pricePaise, @JsonKey(required: true)  DateTime newEndsAt, @JsonKey(required: true)  String orderId, @JsonKey(required: true)  String provider)  $default,) {final _that = this;
switch (_that) {
case _Extension():
return $default(_that.id,_that.extraMinutes,_that.pricePaise,_that.newEndsAt,_that.orderId,_that.provider);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String id, @JsonKey(required: true)  int extraMinutes, @JsonKey(required: true)  int pricePaise, @JsonKey(required: true)  DateTime newEndsAt, @JsonKey(required: true)  String orderId, @JsonKey(required: true)  String provider)?  $default,) {final _that = this;
switch (_that) {
case _Extension() when $default != null:
return $default(_that.id,_that.extraMinutes,_that.pricePaise,_that.newEndsAt,_that.orderId,_that.provider);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Extension implements Extension {
  const _Extension({@JsonKey(required: true) required this.id, @JsonKey(required: true) required this.extraMinutes, @JsonKey(required: true) required this.pricePaise, @JsonKey(required: true) required this.newEndsAt, @JsonKey(required: true) required this.orderId, @JsonKey(required: true) required this.provider});
  factory _Extension.fromJson(Map<String, dynamic> json) => _$ExtensionFromJson(json);

@override@JsonKey(required: true) final  String id;
@override@JsonKey(required: true) final  int extraMinutes;
@override@JsonKey(required: true) final  int pricePaise;
@override@JsonKey(required: true) final  DateTime newEndsAt;
@override@JsonKey(required: true) final  String orderId;
@override@JsonKey(required: true) final  String provider;

/// Create a copy of Extension
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ExtensionCopyWith<_Extension> get copyWith => __$ExtensionCopyWithImpl<_Extension>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ExtensionToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Extension&&(identical(other.id, id) || other.id == id)&&(identical(other.extraMinutes, extraMinutes) || other.extraMinutes == extraMinutes)&&(identical(other.pricePaise, pricePaise) || other.pricePaise == pricePaise)&&(identical(other.newEndsAt, newEndsAt) || other.newEndsAt == newEndsAt)&&(identical(other.orderId, orderId) || other.orderId == orderId)&&(identical(other.provider, provider) || other.provider == provider));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,extraMinutes,pricePaise,newEndsAt,orderId,provider);

@override
String toString() {
  return 'Extension(id: $id, extraMinutes: $extraMinutes, pricePaise: $pricePaise, newEndsAt: $newEndsAt, orderId: $orderId, provider: $provider)';
}


}

/// @nodoc
abstract mixin class _$ExtensionCopyWith<$Res> implements $ExtensionCopyWith<$Res> {
  factory _$ExtensionCopyWith(_Extension value, $Res Function(_Extension) _then) = __$ExtensionCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String id,@JsonKey(required: true) int extraMinutes,@JsonKey(required: true) int pricePaise,@JsonKey(required: true) DateTime newEndsAt,@JsonKey(required: true) String orderId,@JsonKey(required: true) String provider
});




}
/// @nodoc
class __$ExtensionCopyWithImpl<$Res>
    implements _$ExtensionCopyWith<$Res> {
  __$ExtensionCopyWithImpl(this._self, this._then);

  final _Extension _self;
  final $Res Function(_Extension) _then;

/// Create a copy of Extension
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? extraMinutes = null,Object? pricePaise = null,Object? newEndsAt = null,Object? orderId = null,Object? provider = null,}) {
  return _then(_Extension(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,extraMinutes: null == extraMinutes ? _self.extraMinutes : extraMinutes // ignore: cast_nullable_to_non_nullable
as int,pricePaise: null == pricePaise ? _self.pricePaise : pricePaise // ignore: cast_nullable_to_non_nullable
as int,newEndsAt: null == newEndsAt ? _self.newEndsAt : newEndsAt // ignore: cast_nullable_to_non_nullable
as DateTime,orderId: null == orderId ? _self.orderId : orderId // ignore: cast_nullable_to_non_nullable
as String,provider: null == provider ? _self.provider : provider // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
