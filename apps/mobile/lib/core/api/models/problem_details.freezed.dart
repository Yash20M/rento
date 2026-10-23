// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'problem_details.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$FieldError {

@JsonKey(required: true) String get field;@JsonKey(required: true) String get message;
/// Create a copy of FieldError
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FieldErrorCopyWith<FieldError> get copyWith => _$FieldErrorCopyWithImpl<FieldError>(this as FieldError, _$identity);

  /// Serializes this FieldError to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FieldError&&(identical(other.field, field) || other.field == field)&&(identical(other.message, message) || other.message == message));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,field,message);

@override
String toString() {
  return 'FieldError(field: $field, message: $message)';
}


}

/// @nodoc
abstract mixin class $FieldErrorCopyWith<$Res>  {
  factory $FieldErrorCopyWith(FieldError value, $Res Function(FieldError) _then) = _$FieldErrorCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String field,@JsonKey(required: true) String message
});




}
/// @nodoc
class _$FieldErrorCopyWithImpl<$Res>
    implements $FieldErrorCopyWith<$Res> {
  _$FieldErrorCopyWithImpl(this._self, this._then);

  final FieldError _self;
  final $Res Function(FieldError) _then;

/// Create a copy of FieldError
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? field = null,Object? message = null,}) {
  return _then(_self.copyWith(
field: null == field ? _self.field : field // ignore: cast_nullable_to_non_nullable
as String,message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [FieldError].
extension FieldErrorPatterns on FieldError {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FieldError value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FieldError() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FieldError value)  $default,){
final _that = this;
switch (_that) {
case _FieldError():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FieldError value)?  $default,){
final _that = this;
switch (_that) {
case _FieldError() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String field, @JsonKey(required: true)  String message)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FieldError() when $default != null:
return $default(_that.field,_that.message);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String field, @JsonKey(required: true)  String message)  $default,) {final _that = this;
switch (_that) {
case _FieldError():
return $default(_that.field,_that.message);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String field, @JsonKey(required: true)  String message)?  $default,) {final _that = this;
switch (_that) {
case _FieldError() when $default != null:
return $default(_that.field,_that.message);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FieldError implements FieldError {
  const _FieldError({@JsonKey(required: true) required this.field, @JsonKey(required: true) required this.message});
  factory _FieldError.fromJson(Map<String, dynamic> json) => _$FieldErrorFromJson(json);

@override@JsonKey(required: true) final  String field;
@override@JsonKey(required: true) final  String message;

/// Create a copy of FieldError
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FieldErrorCopyWith<_FieldError> get copyWith => __$FieldErrorCopyWithImpl<_FieldError>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FieldErrorToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FieldError&&(identical(other.field, field) || other.field == field)&&(identical(other.message, message) || other.message == message));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,field,message);

@override
String toString() {
  return 'FieldError(field: $field, message: $message)';
}


}

/// @nodoc
abstract mixin class _$FieldErrorCopyWith<$Res> implements $FieldErrorCopyWith<$Res> {
  factory _$FieldErrorCopyWith(_FieldError value, $Res Function(_FieldError) _then) = __$FieldErrorCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String field,@JsonKey(required: true) String message
});




}
/// @nodoc
class __$FieldErrorCopyWithImpl<$Res>
    implements _$FieldErrorCopyWith<$Res> {
  __$FieldErrorCopyWithImpl(this._self, this._then);

  final _FieldError _self;
  final $Res Function(_FieldError) _then;

/// Create a copy of FieldError
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? field = null,Object? message = null,}) {
  return _then(_FieldError(
field: null == field ? _self.field : field // ignore: cast_nullable_to_non_nullable
as String,message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$ProblemDetails {

@JsonKey(required: true) String get type;@JsonKey(required: true) String get title;@JsonKey(required: true) int get status;@JsonKey(required: true, unknownEnumValue: ErrorCode.unknown) ErrorCode get code;@JsonKey(required: true) String get detail;@JsonKey(includeIfNull: false) List<FieldError>? get errors;@JsonKey(required: true) String get traceId;
/// Create a copy of ProblemDetails
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ProblemDetailsCopyWith<ProblemDetails> get copyWith => _$ProblemDetailsCopyWithImpl<ProblemDetails>(this as ProblemDetails, _$identity);

  /// Serializes this ProblemDetails to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ProblemDetails&&(identical(other.type, type) || other.type == type)&&(identical(other.title, title) || other.title == title)&&(identical(other.status, status) || other.status == status)&&(identical(other.code, code) || other.code == code)&&(identical(other.detail, detail) || other.detail == detail)&&const DeepCollectionEquality().equals(other.errors, errors)&&(identical(other.traceId, traceId) || other.traceId == traceId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,type,title,status,code,detail,const DeepCollectionEquality().hash(errors),traceId);

@override
String toString() {
  return 'ProblemDetails(type: $type, title: $title, status: $status, code: $code, detail: $detail, errors: $errors, traceId: $traceId)';
}


}

/// @nodoc
abstract mixin class $ProblemDetailsCopyWith<$Res>  {
  factory $ProblemDetailsCopyWith(ProblemDetails value, $Res Function(ProblemDetails) _then) = _$ProblemDetailsCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String type,@JsonKey(required: true) String title,@JsonKey(required: true) int status,@JsonKey(required: true, unknownEnumValue: ErrorCode.unknown) ErrorCode code,@JsonKey(required: true) String detail,@JsonKey(includeIfNull: false) List<FieldError>? errors,@JsonKey(required: true) String traceId
});




}
/// @nodoc
class _$ProblemDetailsCopyWithImpl<$Res>
    implements $ProblemDetailsCopyWith<$Res> {
  _$ProblemDetailsCopyWithImpl(this._self, this._then);

  final ProblemDetails _self;
  final $Res Function(ProblemDetails) _then;

/// Create a copy of ProblemDetails
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? type = null,Object? title = null,Object? status = null,Object? code = null,Object? detail = null,Object? errors = freezed,Object? traceId = null,}) {
  return _then(_self.copyWith(
type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as int,code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as ErrorCode,detail: null == detail ? _self.detail : detail // ignore: cast_nullable_to_non_nullable
as String,errors: freezed == errors ? _self.errors : errors // ignore: cast_nullable_to_non_nullable
as List<FieldError>?,traceId: null == traceId ? _self.traceId : traceId // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [ProblemDetails].
extension ProblemDetailsPatterns on ProblemDetails {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ProblemDetails value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ProblemDetails() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ProblemDetails value)  $default,){
final _that = this;
switch (_that) {
case _ProblemDetails():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ProblemDetails value)?  $default,){
final _that = this;
switch (_that) {
case _ProblemDetails() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String type, @JsonKey(required: true)  String title, @JsonKey(required: true)  int status, @JsonKey(required: true, unknownEnumValue: ErrorCode.unknown)  ErrorCode code, @JsonKey(required: true)  String detail, @JsonKey(includeIfNull: false)  List<FieldError>? errors, @JsonKey(required: true)  String traceId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ProblemDetails() when $default != null:
return $default(_that.type,_that.title,_that.status,_that.code,_that.detail,_that.errors,_that.traceId);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String type, @JsonKey(required: true)  String title, @JsonKey(required: true)  int status, @JsonKey(required: true, unknownEnumValue: ErrorCode.unknown)  ErrorCode code, @JsonKey(required: true)  String detail, @JsonKey(includeIfNull: false)  List<FieldError>? errors, @JsonKey(required: true)  String traceId)  $default,) {final _that = this;
switch (_that) {
case _ProblemDetails():
return $default(_that.type,_that.title,_that.status,_that.code,_that.detail,_that.errors,_that.traceId);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String type, @JsonKey(required: true)  String title, @JsonKey(required: true)  int status, @JsonKey(required: true, unknownEnumValue: ErrorCode.unknown)  ErrorCode code, @JsonKey(required: true)  String detail, @JsonKey(includeIfNull: false)  List<FieldError>? errors, @JsonKey(required: true)  String traceId)?  $default,) {final _that = this;
switch (_that) {
case _ProblemDetails() when $default != null:
return $default(_that.type,_that.title,_that.status,_that.code,_that.detail,_that.errors,_that.traceId);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ProblemDetails implements ProblemDetails {
  const _ProblemDetails({@JsonKey(required: true) required this.type, @JsonKey(required: true) required this.title, @JsonKey(required: true) required this.status, @JsonKey(required: true, unknownEnumValue: ErrorCode.unknown) required this.code, @JsonKey(required: true) required this.detail, @JsonKey(includeIfNull: false) final  List<FieldError>? errors, @JsonKey(required: true) required this.traceId}): _errors = errors;
  factory _ProblemDetails.fromJson(Map<String, dynamic> json) => _$ProblemDetailsFromJson(json);

@override@JsonKey(required: true) final  String type;
@override@JsonKey(required: true) final  String title;
@override@JsonKey(required: true) final  int status;
@override@JsonKey(required: true, unknownEnumValue: ErrorCode.unknown) final  ErrorCode code;
@override@JsonKey(required: true) final  String detail;
 final  List<FieldError>? _errors;
@override@JsonKey(includeIfNull: false) List<FieldError>? get errors {
  final value = _errors;
  if (value == null) return null;
  if (_errors is EqualUnmodifiableListView) return _errors;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

@override@JsonKey(required: true) final  String traceId;

/// Create a copy of ProblemDetails
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ProblemDetailsCopyWith<_ProblemDetails> get copyWith => __$ProblemDetailsCopyWithImpl<_ProblemDetails>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ProblemDetailsToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ProblemDetails&&(identical(other.type, type) || other.type == type)&&(identical(other.title, title) || other.title == title)&&(identical(other.status, status) || other.status == status)&&(identical(other.code, code) || other.code == code)&&(identical(other.detail, detail) || other.detail == detail)&&const DeepCollectionEquality().equals(other._errors, _errors)&&(identical(other.traceId, traceId) || other.traceId == traceId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,type,title,status,code,detail,const DeepCollectionEquality().hash(_errors),traceId);

@override
String toString() {
  return 'ProblemDetails(type: $type, title: $title, status: $status, code: $code, detail: $detail, errors: $errors, traceId: $traceId)';
}


}

/// @nodoc
abstract mixin class _$ProblemDetailsCopyWith<$Res> implements $ProblemDetailsCopyWith<$Res> {
  factory _$ProblemDetailsCopyWith(_ProblemDetails value, $Res Function(_ProblemDetails) _then) = __$ProblemDetailsCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String type,@JsonKey(required: true) String title,@JsonKey(required: true) int status,@JsonKey(required: true, unknownEnumValue: ErrorCode.unknown) ErrorCode code,@JsonKey(required: true) String detail,@JsonKey(includeIfNull: false) List<FieldError>? errors,@JsonKey(required: true) String traceId
});




}
/// @nodoc
class __$ProblemDetailsCopyWithImpl<$Res>
    implements _$ProblemDetailsCopyWith<$Res> {
  __$ProblemDetailsCopyWithImpl(this._self, this._then);

  final _ProblemDetails _self;
  final $Res Function(_ProblemDetails) _then;

/// Create a copy of ProblemDetails
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? type = null,Object? title = null,Object? status = null,Object? code = null,Object? detail = null,Object? errors = freezed,Object? traceId = null,}) {
  return _then(_ProblemDetails(
type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as int,code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as ErrorCode,detail: null == detail ? _self.detail : detail // ignore: cast_nullable_to_non_nullable
as String,errors: freezed == errors ? _self._errors : errors // ignore: cast_nullable_to_non_nullable
as List<FieldError>?,traceId: null == traceId ? _self.traceId : traceId // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
