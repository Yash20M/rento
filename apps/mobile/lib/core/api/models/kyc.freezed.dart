// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'kyc.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$KycStatus {

/// Whether this deployment requires verification before booking.
@JsonKey(required: true) bool get required;/// `none`, `pending`, `verified` or `rejected`.
@JsonKey(required: true) String get status;/// `XXXX XXXX 1234`.
@JsonKey(required: true) String? get maskedAadhaar;@JsonKey(required: true) DateTime? get verifiedAt;@JsonKey(required: true) String? get verifiedName;/// Why staff declined it.
@JsonKey(required: true) String? get reason;
/// Create a copy of KycStatus
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$KycStatusCopyWith<KycStatus> get copyWith => _$KycStatusCopyWithImpl<KycStatus>(this as KycStatus, _$identity);

  /// Serializes this KycStatus to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is KycStatus&&(identical(other.required, required) || other.required == required)&&(identical(other.status, status) || other.status == status)&&(identical(other.maskedAadhaar, maskedAadhaar) || other.maskedAadhaar == maskedAadhaar)&&(identical(other.verifiedAt, verifiedAt) || other.verifiedAt == verifiedAt)&&(identical(other.verifiedName, verifiedName) || other.verifiedName == verifiedName)&&(identical(other.reason, reason) || other.reason == reason));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,required,status,maskedAadhaar,verifiedAt,verifiedName,reason);

@override
String toString() {
  return 'KycStatus(required: $required, status: $status, maskedAadhaar: $maskedAadhaar, verifiedAt: $verifiedAt, verifiedName: $verifiedName, reason: $reason)';
}


}

/// @nodoc
abstract mixin class $KycStatusCopyWith<$Res>  {
  factory $KycStatusCopyWith(KycStatus value, $Res Function(KycStatus) _then) = _$KycStatusCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) bool required,@JsonKey(required: true) String status,@JsonKey(required: true) String? maskedAadhaar,@JsonKey(required: true) DateTime? verifiedAt,@JsonKey(required: true) String? verifiedName,@JsonKey(required: true) String? reason
});




}
/// @nodoc
class _$KycStatusCopyWithImpl<$Res>
    implements $KycStatusCopyWith<$Res> {
  _$KycStatusCopyWithImpl(this._self, this._then);

  final KycStatus _self;
  final $Res Function(KycStatus) _then;

/// Create a copy of KycStatus
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? required = null,Object? status = null,Object? maskedAadhaar = freezed,Object? verifiedAt = freezed,Object? verifiedName = freezed,Object? reason = freezed,}) {
  return _then(_self.copyWith(
required: null == required ? _self.required : required // ignore: cast_nullable_to_non_nullable
as bool,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,maskedAadhaar: freezed == maskedAadhaar ? _self.maskedAadhaar : maskedAadhaar // ignore: cast_nullable_to_non_nullable
as String?,verifiedAt: freezed == verifiedAt ? _self.verifiedAt : verifiedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,verifiedName: freezed == verifiedName ? _self.verifiedName : verifiedName // ignore: cast_nullable_to_non_nullable
as String?,reason: freezed == reason ? _self.reason : reason // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [KycStatus].
extension KycStatusPatterns on KycStatus {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _KycStatus value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _KycStatus() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _KycStatus value)  $default,){
final _that = this;
switch (_that) {
case _KycStatus():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _KycStatus value)?  $default,){
final _that = this;
switch (_that) {
case _KycStatus() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  bool required, @JsonKey(required: true)  String status, @JsonKey(required: true)  String? maskedAadhaar, @JsonKey(required: true)  DateTime? verifiedAt, @JsonKey(required: true)  String? verifiedName, @JsonKey(required: true)  String? reason)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _KycStatus() when $default != null:
return $default(_that.required,_that.status,_that.maskedAadhaar,_that.verifiedAt,_that.verifiedName,_that.reason);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  bool required, @JsonKey(required: true)  String status, @JsonKey(required: true)  String? maskedAadhaar, @JsonKey(required: true)  DateTime? verifiedAt, @JsonKey(required: true)  String? verifiedName, @JsonKey(required: true)  String? reason)  $default,) {final _that = this;
switch (_that) {
case _KycStatus():
return $default(_that.required,_that.status,_that.maskedAadhaar,_that.verifiedAt,_that.verifiedName,_that.reason);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  bool required, @JsonKey(required: true)  String status, @JsonKey(required: true)  String? maskedAadhaar, @JsonKey(required: true)  DateTime? verifiedAt, @JsonKey(required: true)  String? verifiedName, @JsonKey(required: true)  String? reason)?  $default,) {final _that = this;
switch (_that) {
case _KycStatus() when $default != null:
return $default(_that.required,_that.status,_that.maskedAadhaar,_that.verifiedAt,_that.verifiedName,_that.reason);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _KycStatus implements KycStatus {
  const _KycStatus({@JsonKey(required: true) required this.required, @JsonKey(required: true) required this.status, @JsonKey(required: true) required this.maskedAadhaar, @JsonKey(required: true) required this.verifiedAt, @JsonKey(required: true) required this.verifiedName, @JsonKey(required: true) required this.reason});
  factory _KycStatus.fromJson(Map<String, dynamic> json) => _$KycStatusFromJson(json);

/// Whether this deployment requires verification before booking.
@override@JsonKey(required: true) final  bool required;
/// `none`, `pending`, `verified` or `rejected`.
@override@JsonKey(required: true) final  String status;
/// `XXXX XXXX 1234`.
@override@JsonKey(required: true) final  String? maskedAadhaar;
@override@JsonKey(required: true) final  DateTime? verifiedAt;
@override@JsonKey(required: true) final  String? verifiedName;
/// Why staff declined it.
@override@JsonKey(required: true) final  String? reason;

/// Create a copy of KycStatus
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$KycStatusCopyWith<_KycStatus> get copyWith => __$KycStatusCopyWithImpl<_KycStatus>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$KycStatusToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _KycStatus&&(identical(other.required, required) || other.required == required)&&(identical(other.status, status) || other.status == status)&&(identical(other.maskedAadhaar, maskedAadhaar) || other.maskedAadhaar == maskedAadhaar)&&(identical(other.verifiedAt, verifiedAt) || other.verifiedAt == verifiedAt)&&(identical(other.verifiedName, verifiedName) || other.verifiedName == verifiedName)&&(identical(other.reason, reason) || other.reason == reason));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,required,status,maskedAadhaar,verifiedAt,verifiedName,reason);

@override
String toString() {
  return 'KycStatus(required: $required, status: $status, maskedAadhaar: $maskedAadhaar, verifiedAt: $verifiedAt, verifiedName: $verifiedName, reason: $reason)';
}


}

/// @nodoc
abstract mixin class _$KycStatusCopyWith<$Res> implements $KycStatusCopyWith<$Res> {
  factory _$KycStatusCopyWith(_KycStatus value, $Res Function(_KycStatus) _then) = __$KycStatusCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) bool required,@JsonKey(required: true) String status,@JsonKey(required: true) String? maskedAadhaar,@JsonKey(required: true) DateTime? verifiedAt,@JsonKey(required: true) String? verifiedName,@JsonKey(required: true) String? reason
});




}
/// @nodoc
class __$KycStatusCopyWithImpl<$Res>
    implements _$KycStatusCopyWith<$Res> {
  __$KycStatusCopyWithImpl(this._self, this._then);

  final _KycStatus _self;
  final $Res Function(_KycStatus) _then;

/// Create a copy of KycStatus
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? required = null,Object? status = null,Object? maskedAadhaar = freezed,Object? verifiedAt = freezed,Object? verifiedName = freezed,Object? reason = freezed,}) {
  return _then(_KycStatus(
required: null == required ? _self.required : required // ignore: cast_nullable_to_non_nullable
as bool,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,maskedAadhaar: freezed == maskedAadhaar ? _self.maskedAadhaar : maskedAadhaar // ignore: cast_nullable_to_non_nullable
as String?,verifiedAt: freezed == verifiedAt ? _self.verifiedAt : verifiedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,verifiedName: freezed == verifiedName ? _self.verifiedName : verifiedName // ignore: cast_nullable_to_non_nullable
as String?,reason: freezed == reason ? _self.reason : reason // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$StartAadhaarRequest {

@JsonKey(required: true) String get aadhaarNumber;
/// Create a copy of StartAadhaarRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$StartAadhaarRequestCopyWith<StartAadhaarRequest> get copyWith => _$StartAadhaarRequestCopyWithImpl<StartAadhaarRequest>(this as StartAadhaarRequest, _$identity);

  /// Serializes this StartAadhaarRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is StartAadhaarRequest&&(identical(other.aadhaarNumber, aadhaarNumber) || other.aadhaarNumber == aadhaarNumber));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,aadhaarNumber);

@override
String toString() {
  return 'StartAadhaarRequest(aadhaarNumber: $aadhaarNumber)';
}


}

/// @nodoc
abstract mixin class $StartAadhaarRequestCopyWith<$Res>  {
  factory $StartAadhaarRequestCopyWith(StartAadhaarRequest value, $Res Function(StartAadhaarRequest) _then) = _$StartAadhaarRequestCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String aadhaarNumber
});




}
/// @nodoc
class _$StartAadhaarRequestCopyWithImpl<$Res>
    implements $StartAadhaarRequestCopyWith<$Res> {
  _$StartAadhaarRequestCopyWithImpl(this._self, this._then);

  final StartAadhaarRequest _self;
  final $Res Function(StartAadhaarRequest) _then;

/// Create a copy of StartAadhaarRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? aadhaarNumber = null,}) {
  return _then(_self.copyWith(
aadhaarNumber: null == aadhaarNumber ? _self.aadhaarNumber : aadhaarNumber // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [StartAadhaarRequest].
extension StartAadhaarRequestPatterns on StartAadhaarRequest {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _StartAadhaarRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _StartAadhaarRequest() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _StartAadhaarRequest value)  $default,){
final _that = this;
switch (_that) {
case _StartAadhaarRequest():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _StartAadhaarRequest value)?  $default,){
final _that = this;
switch (_that) {
case _StartAadhaarRequest() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String aadhaarNumber)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _StartAadhaarRequest() when $default != null:
return $default(_that.aadhaarNumber);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String aadhaarNumber)  $default,) {final _that = this;
switch (_that) {
case _StartAadhaarRequest():
return $default(_that.aadhaarNumber);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String aadhaarNumber)?  $default,) {final _that = this;
switch (_that) {
case _StartAadhaarRequest() when $default != null:
return $default(_that.aadhaarNumber);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _StartAadhaarRequest implements StartAadhaarRequest {
  const _StartAadhaarRequest({@JsonKey(required: true) required this.aadhaarNumber});
  factory _StartAadhaarRequest.fromJson(Map<String, dynamic> json) => _$StartAadhaarRequestFromJson(json);

@override@JsonKey(required: true) final  String aadhaarNumber;

/// Create a copy of StartAadhaarRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$StartAadhaarRequestCopyWith<_StartAadhaarRequest> get copyWith => __$StartAadhaarRequestCopyWithImpl<_StartAadhaarRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$StartAadhaarRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _StartAadhaarRequest&&(identical(other.aadhaarNumber, aadhaarNumber) || other.aadhaarNumber == aadhaarNumber));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,aadhaarNumber);

@override
String toString() {
  return 'StartAadhaarRequest(aadhaarNumber: $aadhaarNumber)';
}


}

/// @nodoc
abstract mixin class _$StartAadhaarRequestCopyWith<$Res> implements $StartAadhaarRequestCopyWith<$Res> {
  factory _$StartAadhaarRequestCopyWith(_StartAadhaarRequest value, $Res Function(_StartAadhaarRequest) _then) = __$StartAadhaarRequestCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String aadhaarNumber
});




}
/// @nodoc
class __$StartAadhaarRequestCopyWithImpl<$Res>
    implements _$StartAadhaarRequestCopyWith<$Res> {
  __$StartAadhaarRequestCopyWithImpl(this._self, this._then);

  final _StartAadhaarRequest _self;
  final $Res Function(_StartAadhaarRequest) _then;

/// Create a copy of StartAadhaarRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? aadhaarNumber = null,}) {
  return _then(_StartAadhaarRequest(
aadhaarNumber: null == aadhaarNumber ? _self.aadhaarNumber : aadhaarNumber // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$AadhaarRequest {

@JsonKey(required: true) String get requestId;@JsonKey(required: true) DateTime get expiresAt;@JsonKey(required: true) String get maskedAadhaar;
/// Create a copy of AadhaarRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AadhaarRequestCopyWith<AadhaarRequest> get copyWith => _$AadhaarRequestCopyWithImpl<AadhaarRequest>(this as AadhaarRequest, _$identity);

  /// Serializes this AadhaarRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AadhaarRequest&&(identical(other.requestId, requestId) || other.requestId == requestId)&&(identical(other.expiresAt, expiresAt) || other.expiresAt == expiresAt)&&(identical(other.maskedAadhaar, maskedAadhaar) || other.maskedAadhaar == maskedAadhaar));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,requestId,expiresAt,maskedAadhaar);

@override
String toString() {
  return 'AadhaarRequest(requestId: $requestId, expiresAt: $expiresAt, maskedAadhaar: $maskedAadhaar)';
}


}

/// @nodoc
abstract mixin class $AadhaarRequestCopyWith<$Res>  {
  factory $AadhaarRequestCopyWith(AadhaarRequest value, $Res Function(AadhaarRequest) _then) = _$AadhaarRequestCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String requestId,@JsonKey(required: true) DateTime expiresAt,@JsonKey(required: true) String maskedAadhaar
});




}
/// @nodoc
class _$AadhaarRequestCopyWithImpl<$Res>
    implements $AadhaarRequestCopyWith<$Res> {
  _$AadhaarRequestCopyWithImpl(this._self, this._then);

  final AadhaarRequest _self;
  final $Res Function(AadhaarRequest) _then;

/// Create a copy of AadhaarRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? requestId = null,Object? expiresAt = null,Object? maskedAadhaar = null,}) {
  return _then(_self.copyWith(
requestId: null == requestId ? _self.requestId : requestId // ignore: cast_nullable_to_non_nullable
as String,expiresAt: null == expiresAt ? _self.expiresAt : expiresAt // ignore: cast_nullable_to_non_nullable
as DateTime,maskedAadhaar: null == maskedAadhaar ? _self.maskedAadhaar : maskedAadhaar // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [AadhaarRequest].
extension AadhaarRequestPatterns on AadhaarRequest {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AadhaarRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AadhaarRequest() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AadhaarRequest value)  $default,){
final _that = this;
switch (_that) {
case _AadhaarRequest():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AadhaarRequest value)?  $default,){
final _that = this;
switch (_that) {
case _AadhaarRequest() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String requestId, @JsonKey(required: true)  DateTime expiresAt, @JsonKey(required: true)  String maskedAadhaar)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AadhaarRequest() when $default != null:
return $default(_that.requestId,_that.expiresAt,_that.maskedAadhaar);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String requestId, @JsonKey(required: true)  DateTime expiresAt, @JsonKey(required: true)  String maskedAadhaar)  $default,) {final _that = this;
switch (_that) {
case _AadhaarRequest():
return $default(_that.requestId,_that.expiresAt,_that.maskedAadhaar);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String requestId, @JsonKey(required: true)  DateTime expiresAt, @JsonKey(required: true)  String maskedAadhaar)?  $default,) {final _that = this;
switch (_that) {
case _AadhaarRequest() when $default != null:
return $default(_that.requestId,_that.expiresAt,_that.maskedAadhaar);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _AadhaarRequest implements AadhaarRequest {
  const _AadhaarRequest({@JsonKey(required: true) required this.requestId, @JsonKey(required: true) required this.expiresAt, @JsonKey(required: true) required this.maskedAadhaar});
  factory _AadhaarRequest.fromJson(Map<String, dynamic> json) => _$AadhaarRequestFromJson(json);

@override@JsonKey(required: true) final  String requestId;
@override@JsonKey(required: true) final  DateTime expiresAt;
@override@JsonKey(required: true) final  String maskedAadhaar;

/// Create a copy of AadhaarRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AadhaarRequestCopyWith<_AadhaarRequest> get copyWith => __$AadhaarRequestCopyWithImpl<_AadhaarRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AadhaarRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AadhaarRequest&&(identical(other.requestId, requestId) || other.requestId == requestId)&&(identical(other.expiresAt, expiresAt) || other.expiresAt == expiresAt)&&(identical(other.maskedAadhaar, maskedAadhaar) || other.maskedAadhaar == maskedAadhaar));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,requestId,expiresAt,maskedAadhaar);

@override
String toString() {
  return 'AadhaarRequest(requestId: $requestId, expiresAt: $expiresAt, maskedAadhaar: $maskedAadhaar)';
}


}

/// @nodoc
abstract mixin class _$AadhaarRequestCopyWith<$Res> implements $AadhaarRequestCopyWith<$Res> {
  factory _$AadhaarRequestCopyWith(_AadhaarRequest value, $Res Function(_AadhaarRequest) _then) = __$AadhaarRequestCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String requestId,@JsonKey(required: true) DateTime expiresAt,@JsonKey(required: true) String maskedAadhaar
});




}
/// @nodoc
class __$AadhaarRequestCopyWithImpl<$Res>
    implements _$AadhaarRequestCopyWith<$Res> {
  __$AadhaarRequestCopyWithImpl(this._self, this._then);

  final _AadhaarRequest _self;
  final $Res Function(_AadhaarRequest) _then;

/// Create a copy of AadhaarRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? requestId = null,Object? expiresAt = null,Object? maskedAadhaar = null,}) {
  return _then(_AadhaarRequest(
requestId: null == requestId ? _self.requestId : requestId // ignore: cast_nullable_to_non_nullable
as String,expiresAt: null == expiresAt ? _self.expiresAt : expiresAt // ignore: cast_nullable_to_non_nullable
as DateTime,maskedAadhaar: null == maskedAadhaar ? _self.maskedAadhaar : maskedAadhaar // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$VerifyAadhaarRequest {

@JsonKey(required: true) String get requestId;@JsonKey(required: true) String get otp;
/// Create a copy of VerifyAadhaarRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$VerifyAadhaarRequestCopyWith<VerifyAadhaarRequest> get copyWith => _$VerifyAadhaarRequestCopyWithImpl<VerifyAadhaarRequest>(this as VerifyAadhaarRequest, _$identity);

  /// Serializes this VerifyAadhaarRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is VerifyAadhaarRequest&&(identical(other.requestId, requestId) || other.requestId == requestId)&&(identical(other.otp, otp) || other.otp == otp));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,requestId,otp);

@override
String toString() {
  return 'VerifyAadhaarRequest(requestId: $requestId, otp: $otp)';
}


}

/// @nodoc
abstract mixin class $VerifyAadhaarRequestCopyWith<$Res>  {
  factory $VerifyAadhaarRequestCopyWith(VerifyAadhaarRequest value, $Res Function(VerifyAadhaarRequest) _then) = _$VerifyAadhaarRequestCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String requestId,@JsonKey(required: true) String otp
});




}
/// @nodoc
class _$VerifyAadhaarRequestCopyWithImpl<$Res>
    implements $VerifyAadhaarRequestCopyWith<$Res> {
  _$VerifyAadhaarRequestCopyWithImpl(this._self, this._then);

  final VerifyAadhaarRequest _self;
  final $Res Function(VerifyAadhaarRequest) _then;

/// Create a copy of VerifyAadhaarRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? requestId = null,Object? otp = null,}) {
  return _then(_self.copyWith(
requestId: null == requestId ? _self.requestId : requestId // ignore: cast_nullable_to_non_nullable
as String,otp: null == otp ? _self.otp : otp // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [VerifyAadhaarRequest].
extension VerifyAadhaarRequestPatterns on VerifyAadhaarRequest {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _VerifyAadhaarRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _VerifyAadhaarRequest() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _VerifyAadhaarRequest value)  $default,){
final _that = this;
switch (_that) {
case _VerifyAadhaarRequest():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _VerifyAadhaarRequest value)?  $default,){
final _that = this;
switch (_that) {
case _VerifyAadhaarRequest() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String requestId, @JsonKey(required: true)  String otp)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _VerifyAadhaarRequest() when $default != null:
return $default(_that.requestId,_that.otp);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String requestId, @JsonKey(required: true)  String otp)  $default,) {final _that = this;
switch (_that) {
case _VerifyAadhaarRequest():
return $default(_that.requestId,_that.otp);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String requestId, @JsonKey(required: true)  String otp)?  $default,) {final _that = this;
switch (_that) {
case _VerifyAadhaarRequest() when $default != null:
return $default(_that.requestId,_that.otp);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _VerifyAadhaarRequest implements VerifyAadhaarRequest {
  const _VerifyAadhaarRequest({@JsonKey(required: true) required this.requestId, @JsonKey(required: true) required this.otp});
  factory _VerifyAadhaarRequest.fromJson(Map<String, dynamic> json) => _$VerifyAadhaarRequestFromJson(json);

@override@JsonKey(required: true) final  String requestId;
@override@JsonKey(required: true) final  String otp;

/// Create a copy of VerifyAadhaarRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$VerifyAadhaarRequestCopyWith<_VerifyAadhaarRequest> get copyWith => __$VerifyAadhaarRequestCopyWithImpl<_VerifyAadhaarRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$VerifyAadhaarRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _VerifyAadhaarRequest&&(identical(other.requestId, requestId) || other.requestId == requestId)&&(identical(other.otp, otp) || other.otp == otp));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,requestId,otp);

@override
String toString() {
  return 'VerifyAadhaarRequest(requestId: $requestId, otp: $otp)';
}


}

/// @nodoc
abstract mixin class _$VerifyAadhaarRequestCopyWith<$Res> implements $VerifyAadhaarRequestCopyWith<$Res> {
  factory _$VerifyAadhaarRequestCopyWith(_VerifyAadhaarRequest value, $Res Function(_VerifyAadhaarRequest) _then) = __$VerifyAadhaarRequestCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String requestId,@JsonKey(required: true) String otp
});




}
/// @nodoc
class __$VerifyAadhaarRequestCopyWithImpl<$Res>
    implements _$VerifyAadhaarRequestCopyWith<$Res> {
  __$VerifyAadhaarRequestCopyWithImpl(this._self, this._then);

  final _VerifyAadhaarRequest _self;
  final $Res Function(_VerifyAadhaarRequest) _then;

/// Create a copy of VerifyAadhaarRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? requestId = null,Object? otp = null,}) {
  return _then(_VerifyAadhaarRequest(
requestId: null == requestId ? _self.requestId : requestId // ignore: cast_nullable_to_non_nullable
as String,otp: null == otp ? _self.otp : otp // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
