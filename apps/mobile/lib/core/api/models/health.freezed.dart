// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'health.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$HealthResponse {

@JsonKey(required: true) String get status;
/// Create a copy of HealthResponse
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$HealthResponseCopyWith<HealthResponse> get copyWith => _$HealthResponseCopyWithImpl<HealthResponse>(this as HealthResponse, _$identity);

  /// Serializes this HealthResponse to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is HealthResponse&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status);

@override
String toString() {
  return 'HealthResponse(status: $status)';
}


}

/// @nodoc
abstract mixin class $HealthResponseCopyWith<$Res>  {
  factory $HealthResponseCopyWith(HealthResponse value, $Res Function(HealthResponse) _then) = _$HealthResponseCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String status
});




}
/// @nodoc
class _$HealthResponseCopyWithImpl<$Res>
    implements $HealthResponseCopyWith<$Res> {
  _$HealthResponseCopyWithImpl(this._self, this._then);

  final HealthResponse _self;
  final $Res Function(HealthResponse) _then;

/// Create a copy of HealthResponse
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? status = null,}) {
  return _then(_self.copyWith(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [HealthResponse].
extension HealthResponsePatterns on HealthResponse {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _HealthResponse value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _HealthResponse() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _HealthResponse value)  $default,){
final _that = this;
switch (_that) {
case _HealthResponse():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _HealthResponse value)?  $default,){
final _that = this;
switch (_that) {
case _HealthResponse() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String status)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _HealthResponse() when $default != null:
return $default(_that.status);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String status)  $default,) {final _that = this;
switch (_that) {
case _HealthResponse():
return $default(_that.status);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String status)?  $default,) {final _that = this;
switch (_that) {
case _HealthResponse() when $default != null:
return $default(_that.status);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _HealthResponse implements HealthResponse {
  const _HealthResponse({@JsonKey(required: true) required this.status});
  factory _HealthResponse.fromJson(Map<String, dynamic> json) => _$HealthResponseFromJson(json);

@override@JsonKey(required: true) final  String status;

/// Create a copy of HealthResponse
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$HealthResponseCopyWith<_HealthResponse> get copyWith => __$HealthResponseCopyWithImpl<_HealthResponse>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$HealthResponseToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _HealthResponse&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status);

@override
String toString() {
  return 'HealthResponse(status: $status)';
}


}

/// @nodoc
abstract mixin class _$HealthResponseCopyWith<$Res> implements $HealthResponseCopyWith<$Res> {
  factory _$HealthResponseCopyWith(_HealthResponse value, $Res Function(_HealthResponse) _then) = __$HealthResponseCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String status
});




}
/// @nodoc
class __$HealthResponseCopyWithImpl<$Res>
    implements _$HealthResponseCopyWith<$Res> {
  __$HealthResponseCopyWithImpl(this._self, this._then);

  final _HealthResponse _self;
  final $Res Function(_HealthResponse) _then;

/// Create a copy of HealthResponse
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? status = null,}) {
  return _then(_HealthResponse(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$ReadinessChecks {

@JsonKey(required: true) String get database;
/// Create a copy of ReadinessChecks
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ReadinessChecksCopyWith<ReadinessChecks> get copyWith => _$ReadinessChecksCopyWithImpl<ReadinessChecks>(this as ReadinessChecks, _$identity);

  /// Serializes this ReadinessChecks to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ReadinessChecks&&(identical(other.database, database) || other.database == database));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,database);

@override
String toString() {
  return 'ReadinessChecks(database: $database)';
}


}

/// @nodoc
abstract mixin class $ReadinessChecksCopyWith<$Res>  {
  factory $ReadinessChecksCopyWith(ReadinessChecks value, $Res Function(ReadinessChecks) _then) = _$ReadinessChecksCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String database
});




}
/// @nodoc
class _$ReadinessChecksCopyWithImpl<$Res>
    implements $ReadinessChecksCopyWith<$Res> {
  _$ReadinessChecksCopyWithImpl(this._self, this._then);

  final ReadinessChecks _self;
  final $Res Function(ReadinessChecks) _then;

/// Create a copy of ReadinessChecks
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? database = null,}) {
  return _then(_self.copyWith(
database: null == database ? _self.database : database // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [ReadinessChecks].
extension ReadinessChecksPatterns on ReadinessChecks {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ReadinessChecks value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ReadinessChecks() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ReadinessChecks value)  $default,){
final _that = this;
switch (_that) {
case _ReadinessChecks():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ReadinessChecks value)?  $default,){
final _that = this;
switch (_that) {
case _ReadinessChecks() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String database)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ReadinessChecks() when $default != null:
return $default(_that.database);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String database)  $default,) {final _that = this;
switch (_that) {
case _ReadinessChecks():
return $default(_that.database);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String database)?  $default,) {final _that = this;
switch (_that) {
case _ReadinessChecks() when $default != null:
return $default(_that.database);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ReadinessChecks implements ReadinessChecks {
  const _ReadinessChecks({@JsonKey(required: true) required this.database});
  factory _ReadinessChecks.fromJson(Map<String, dynamic> json) => _$ReadinessChecksFromJson(json);

@override@JsonKey(required: true) final  String database;

/// Create a copy of ReadinessChecks
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ReadinessChecksCopyWith<_ReadinessChecks> get copyWith => __$ReadinessChecksCopyWithImpl<_ReadinessChecks>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ReadinessChecksToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ReadinessChecks&&(identical(other.database, database) || other.database == database));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,database);

@override
String toString() {
  return 'ReadinessChecks(database: $database)';
}


}

/// @nodoc
abstract mixin class _$ReadinessChecksCopyWith<$Res> implements $ReadinessChecksCopyWith<$Res> {
  factory _$ReadinessChecksCopyWith(_ReadinessChecks value, $Res Function(_ReadinessChecks) _then) = __$ReadinessChecksCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String database
});




}
/// @nodoc
class __$ReadinessChecksCopyWithImpl<$Res>
    implements _$ReadinessChecksCopyWith<$Res> {
  __$ReadinessChecksCopyWithImpl(this._self, this._then);

  final _ReadinessChecks _self;
  final $Res Function(_ReadinessChecks) _then;

/// Create a copy of ReadinessChecks
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? database = null,}) {
  return _then(_ReadinessChecks(
database: null == database ? _self.database : database // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$ReadinessResponse {

@JsonKey(required: true) String get status;@JsonKey(required: true) ReadinessChecks get checks;
/// Create a copy of ReadinessResponse
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ReadinessResponseCopyWith<ReadinessResponse> get copyWith => _$ReadinessResponseCopyWithImpl<ReadinessResponse>(this as ReadinessResponse, _$identity);

  /// Serializes this ReadinessResponse to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ReadinessResponse&&(identical(other.status, status) || other.status == status)&&(identical(other.checks, checks) || other.checks == checks));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,checks);

@override
String toString() {
  return 'ReadinessResponse(status: $status, checks: $checks)';
}


}

/// @nodoc
abstract mixin class $ReadinessResponseCopyWith<$Res>  {
  factory $ReadinessResponseCopyWith(ReadinessResponse value, $Res Function(ReadinessResponse) _then) = _$ReadinessResponseCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String status,@JsonKey(required: true) ReadinessChecks checks
});


$ReadinessChecksCopyWith<$Res> get checks;

}
/// @nodoc
class _$ReadinessResponseCopyWithImpl<$Res>
    implements $ReadinessResponseCopyWith<$Res> {
  _$ReadinessResponseCopyWithImpl(this._self, this._then);

  final ReadinessResponse _self;
  final $Res Function(ReadinessResponse) _then;

/// Create a copy of ReadinessResponse
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? status = null,Object? checks = null,}) {
  return _then(_self.copyWith(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,checks: null == checks ? _self.checks : checks // ignore: cast_nullable_to_non_nullable
as ReadinessChecks,
  ));
}
/// Create a copy of ReadinessResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ReadinessChecksCopyWith<$Res> get checks {
  
  return $ReadinessChecksCopyWith<$Res>(_self.checks, (value) {
    return _then(_self.copyWith(checks: value));
  });
}
}


/// Adds pattern-matching-related methods to [ReadinessResponse].
extension ReadinessResponsePatterns on ReadinessResponse {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ReadinessResponse value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ReadinessResponse() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ReadinessResponse value)  $default,){
final _that = this;
switch (_that) {
case _ReadinessResponse():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ReadinessResponse value)?  $default,){
final _that = this;
switch (_that) {
case _ReadinessResponse() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String status, @JsonKey(required: true)  ReadinessChecks checks)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ReadinessResponse() when $default != null:
return $default(_that.status,_that.checks);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String status, @JsonKey(required: true)  ReadinessChecks checks)  $default,) {final _that = this;
switch (_that) {
case _ReadinessResponse():
return $default(_that.status,_that.checks);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String status, @JsonKey(required: true)  ReadinessChecks checks)?  $default,) {final _that = this;
switch (_that) {
case _ReadinessResponse() when $default != null:
return $default(_that.status,_that.checks);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ReadinessResponse implements ReadinessResponse {
  const _ReadinessResponse({@JsonKey(required: true) required this.status, @JsonKey(required: true) required this.checks});
  factory _ReadinessResponse.fromJson(Map<String, dynamic> json) => _$ReadinessResponseFromJson(json);

@override@JsonKey(required: true) final  String status;
@override@JsonKey(required: true) final  ReadinessChecks checks;

/// Create a copy of ReadinessResponse
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ReadinessResponseCopyWith<_ReadinessResponse> get copyWith => __$ReadinessResponseCopyWithImpl<_ReadinessResponse>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ReadinessResponseToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ReadinessResponse&&(identical(other.status, status) || other.status == status)&&(identical(other.checks, checks) || other.checks == checks));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,checks);

@override
String toString() {
  return 'ReadinessResponse(status: $status, checks: $checks)';
}


}

/// @nodoc
abstract mixin class _$ReadinessResponseCopyWith<$Res> implements $ReadinessResponseCopyWith<$Res> {
  factory _$ReadinessResponseCopyWith(_ReadinessResponse value, $Res Function(_ReadinessResponse) _then) = __$ReadinessResponseCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String status,@JsonKey(required: true) ReadinessChecks checks
});


@override $ReadinessChecksCopyWith<$Res> get checks;

}
/// @nodoc
class __$ReadinessResponseCopyWithImpl<$Res>
    implements _$ReadinessResponseCopyWith<$Res> {
  __$ReadinessResponseCopyWithImpl(this._self, this._then);

  final _ReadinessResponse _self;
  final $Res Function(_ReadinessResponse) _then;

/// Create a copy of ReadinessResponse
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? status = null,Object? checks = null,}) {
  return _then(_ReadinessResponse(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,checks: null == checks ? _self.checks : checks // ignore: cast_nullable_to_non_nullable
as ReadinessChecks,
  ));
}

/// Create a copy of ReadinessResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ReadinessChecksCopyWith<$Res> get checks {
  
  return $ReadinessChecksCopyWith<$Res>(_self.checks, (value) {
    return _then(_self.copyWith(checks: value));
  });
}
}

// dart format on
