// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'social.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$GoogleLoginRequest {

@JsonKey(required: true) String get idToken;
/// Create a copy of GoogleLoginRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GoogleLoginRequestCopyWith<GoogleLoginRequest> get copyWith => _$GoogleLoginRequestCopyWithImpl<GoogleLoginRequest>(this as GoogleLoginRequest, _$identity);

  /// Serializes this GoogleLoginRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GoogleLoginRequest&&(identical(other.idToken, idToken) || other.idToken == idToken));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,idToken);

@override
String toString() {
  return 'GoogleLoginRequest(idToken: $idToken)';
}


}

/// @nodoc
abstract mixin class $GoogleLoginRequestCopyWith<$Res>  {
  factory $GoogleLoginRequestCopyWith(GoogleLoginRequest value, $Res Function(GoogleLoginRequest) _then) = _$GoogleLoginRequestCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String idToken
});




}
/// @nodoc
class _$GoogleLoginRequestCopyWithImpl<$Res>
    implements $GoogleLoginRequestCopyWith<$Res> {
  _$GoogleLoginRequestCopyWithImpl(this._self, this._then);

  final GoogleLoginRequest _self;
  final $Res Function(GoogleLoginRequest) _then;

/// Create a copy of GoogleLoginRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? idToken = null,}) {
  return _then(_self.copyWith(
idToken: null == idToken ? _self.idToken : idToken // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [GoogleLoginRequest].
extension GoogleLoginRequestPatterns on GoogleLoginRequest {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GoogleLoginRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GoogleLoginRequest() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GoogleLoginRequest value)  $default,){
final _that = this;
switch (_that) {
case _GoogleLoginRequest():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GoogleLoginRequest value)?  $default,){
final _that = this;
switch (_that) {
case _GoogleLoginRequest() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String idToken)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GoogleLoginRequest() when $default != null:
return $default(_that.idToken);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String idToken)  $default,) {final _that = this;
switch (_that) {
case _GoogleLoginRequest():
return $default(_that.idToken);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String idToken)?  $default,) {final _that = this;
switch (_that) {
case _GoogleLoginRequest() when $default != null:
return $default(_that.idToken);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GoogleLoginRequest implements GoogleLoginRequest {
  const _GoogleLoginRequest({@JsonKey(required: true) required this.idToken});
  factory _GoogleLoginRequest.fromJson(Map<String, dynamic> json) => _$GoogleLoginRequestFromJson(json);

@override@JsonKey(required: true) final  String idToken;

/// Create a copy of GoogleLoginRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GoogleLoginRequestCopyWith<_GoogleLoginRequest> get copyWith => __$GoogleLoginRequestCopyWithImpl<_GoogleLoginRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GoogleLoginRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _GoogleLoginRequest&&(identical(other.idToken, idToken) || other.idToken == idToken));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,idToken);

@override
String toString() {
  return 'GoogleLoginRequest(idToken: $idToken)';
}


}

/// @nodoc
abstract mixin class _$GoogleLoginRequestCopyWith<$Res> implements $GoogleLoginRequestCopyWith<$Res> {
  factory _$GoogleLoginRequestCopyWith(_GoogleLoginRequest value, $Res Function(_GoogleLoginRequest) _then) = __$GoogleLoginRequestCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String idToken
});




}
/// @nodoc
class __$GoogleLoginRequestCopyWithImpl<$Res>
    implements _$GoogleLoginRequestCopyWith<$Res> {
  __$GoogleLoginRequestCopyWithImpl(this._self, this._then);

  final _GoogleLoginRequest _self;
  final $Res Function(_GoogleLoginRequest) _then;

/// Create a copy of GoogleLoginRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? idToken = null,}) {
  return _then(_GoogleLoginRequest(
idToken: null == idToken ? _self.idToken : idToken // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$FacebookLoginRequest {

@JsonKey(includeIfNull: false) String? get accessToken;@JsonKey(includeIfNull: false) String? get authenticationToken;@JsonKey(includeIfNull: false) String? get nonce;
/// Create a copy of FacebookLoginRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FacebookLoginRequestCopyWith<FacebookLoginRequest> get copyWith => _$FacebookLoginRequestCopyWithImpl<FacebookLoginRequest>(this as FacebookLoginRequest, _$identity);

  /// Serializes this FacebookLoginRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FacebookLoginRequest&&(identical(other.accessToken, accessToken) || other.accessToken == accessToken)&&(identical(other.authenticationToken, authenticationToken) || other.authenticationToken == authenticationToken)&&(identical(other.nonce, nonce) || other.nonce == nonce));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,accessToken,authenticationToken,nonce);

@override
String toString() {
  return 'FacebookLoginRequest(accessToken: $accessToken, authenticationToken: $authenticationToken, nonce: $nonce)';
}


}

/// @nodoc
abstract mixin class $FacebookLoginRequestCopyWith<$Res>  {
  factory $FacebookLoginRequestCopyWith(FacebookLoginRequest value, $Res Function(FacebookLoginRequest) _then) = _$FacebookLoginRequestCopyWithImpl;
@useResult
$Res call({
@JsonKey(includeIfNull: false) String? accessToken,@JsonKey(includeIfNull: false) String? authenticationToken,@JsonKey(includeIfNull: false) String? nonce
});




}
/// @nodoc
class _$FacebookLoginRequestCopyWithImpl<$Res>
    implements $FacebookLoginRequestCopyWith<$Res> {
  _$FacebookLoginRequestCopyWithImpl(this._self, this._then);

  final FacebookLoginRequest _self;
  final $Res Function(FacebookLoginRequest) _then;

/// Create a copy of FacebookLoginRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? accessToken = freezed,Object? authenticationToken = freezed,Object? nonce = freezed,}) {
  return _then(_self.copyWith(
accessToken: freezed == accessToken ? _self.accessToken : accessToken // ignore: cast_nullable_to_non_nullable
as String?,authenticationToken: freezed == authenticationToken ? _self.authenticationToken : authenticationToken // ignore: cast_nullable_to_non_nullable
as String?,nonce: freezed == nonce ? _self.nonce : nonce // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [FacebookLoginRequest].
extension FacebookLoginRequestPatterns on FacebookLoginRequest {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FacebookLoginRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FacebookLoginRequest() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FacebookLoginRequest value)  $default,){
final _that = this;
switch (_that) {
case _FacebookLoginRequest():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FacebookLoginRequest value)?  $default,){
final _that = this;
switch (_that) {
case _FacebookLoginRequest() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(includeIfNull: false)  String? accessToken, @JsonKey(includeIfNull: false)  String? authenticationToken, @JsonKey(includeIfNull: false)  String? nonce)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FacebookLoginRequest() when $default != null:
return $default(_that.accessToken,_that.authenticationToken,_that.nonce);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(includeIfNull: false)  String? accessToken, @JsonKey(includeIfNull: false)  String? authenticationToken, @JsonKey(includeIfNull: false)  String? nonce)  $default,) {final _that = this;
switch (_that) {
case _FacebookLoginRequest():
return $default(_that.accessToken,_that.authenticationToken,_that.nonce);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(includeIfNull: false)  String? accessToken, @JsonKey(includeIfNull: false)  String? authenticationToken, @JsonKey(includeIfNull: false)  String? nonce)?  $default,) {final _that = this;
switch (_that) {
case _FacebookLoginRequest() when $default != null:
return $default(_that.accessToken,_that.authenticationToken,_that.nonce);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FacebookLoginRequest implements FacebookLoginRequest {
  const _FacebookLoginRequest({@JsonKey(includeIfNull: false) this.accessToken, @JsonKey(includeIfNull: false) this.authenticationToken, @JsonKey(includeIfNull: false) this.nonce});
  factory _FacebookLoginRequest.fromJson(Map<String, dynamic> json) => _$FacebookLoginRequestFromJson(json);

@override@JsonKey(includeIfNull: false) final  String? accessToken;
@override@JsonKey(includeIfNull: false) final  String? authenticationToken;
@override@JsonKey(includeIfNull: false) final  String? nonce;

/// Create a copy of FacebookLoginRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FacebookLoginRequestCopyWith<_FacebookLoginRequest> get copyWith => __$FacebookLoginRequestCopyWithImpl<_FacebookLoginRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FacebookLoginRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _FacebookLoginRequest&&(identical(other.accessToken, accessToken) || other.accessToken == accessToken)&&(identical(other.authenticationToken, authenticationToken) || other.authenticationToken == authenticationToken)&&(identical(other.nonce, nonce) || other.nonce == nonce));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,accessToken,authenticationToken,nonce);

@override
String toString() {
  return 'FacebookLoginRequest(accessToken: $accessToken, authenticationToken: $authenticationToken, nonce: $nonce)';
}


}

/// @nodoc
abstract mixin class _$FacebookLoginRequestCopyWith<$Res> implements $FacebookLoginRequestCopyWith<$Res> {
  factory _$FacebookLoginRequestCopyWith(_FacebookLoginRequest value, $Res Function(_FacebookLoginRequest) _then) = __$FacebookLoginRequestCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(includeIfNull: false) String? accessToken,@JsonKey(includeIfNull: false) String? authenticationToken,@JsonKey(includeIfNull: false) String? nonce
});




}
/// @nodoc
class __$FacebookLoginRequestCopyWithImpl<$Res>
    implements _$FacebookLoginRequestCopyWith<$Res> {
  __$FacebookLoginRequestCopyWithImpl(this._self, this._then);

  final _FacebookLoginRequest _self;
  final $Res Function(_FacebookLoginRequest) _then;

/// Create a copy of FacebookLoginRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? accessToken = freezed,Object? authenticationToken = freezed,Object? nonce = freezed,}) {
  return _then(_FacebookLoginRequest(
accessToken: freezed == accessToken ? _self.accessToken : accessToken // ignore: cast_nullable_to_non_nullable
as String?,authenticationToken: freezed == authenticationToken ? _self.authenticationToken : authenticationToken // ignore: cast_nullable_to_non_nullable
as String?,nonce: freezed == nonce ? _self.nonce : nonce // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$AppleLoginRequest {

@JsonKey(required: true) String get identityToken;@JsonKey(required: true) String get nonce;/// Apple only delivers the name on the first sign-in; forward it then.
@JsonKey(includeIfNull: false) String? get fullName;
/// Create a copy of AppleLoginRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AppleLoginRequestCopyWith<AppleLoginRequest> get copyWith => _$AppleLoginRequestCopyWithImpl<AppleLoginRequest>(this as AppleLoginRequest, _$identity);

  /// Serializes this AppleLoginRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AppleLoginRequest&&(identical(other.identityToken, identityToken) || other.identityToken == identityToken)&&(identical(other.nonce, nonce) || other.nonce == nonce)&&(identical(other.fullName, fullName) || other.fullName == fullName));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,identityToken,nonce,fullName);

@override
String toString() {
  return 'AppleLoginRequest(identityToken: $identityToken, nonce: $nonce, fullName: $fullName)';
}


}

/// @nodoc
abstract mixin class $AppleLoginRequestCopyWith<$Res>  {
  factory $AppleLoginRequestCopyWith(AppleLoginRequest value, $Res Function(AppleLoginRequest) _then) = _$AppleLoginRequestCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String identityToken,@JsonKey(required: true) String nonce,@JsonKey(includeIfNull: false) String? fullName
});




}
/// @nodoc
class _$AppleLoginRequestCopyWithImpl<$Res>
    implements $AppleLoginRequestCopyWith<$Res> {
  _$AppleLoginRequestCopyWithImpl(this._self, this._then);

  final AppleLoginRequest _self;
  final $Res Function(AppleLoginRequest) _then;

/// Create a copy of AppleLoginRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? identityToken = null,Object? nonce = null,Object? fullName = freezed,}) {
  return _then(_self.copyWith(
identityToken: null == identityToken ? _self.identityToken : identityToken // ignore: cast_nullable_to_non_nullable
as String,nonce: null == nonce ? _self.nonce : nonce // ignore: cast_nullable_to_non_nullable
as String,fullName: freezed == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [AppleLoginRequest].
extension AppleLoginRequestPatterns on AppleLoginRequest {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AppleLoginRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AppleLoginRequest() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AppleLoginRequest value)  $default,){
final _that = this;
switch (_that) {
case _AppleLoginRequest():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AppleLoginRequest value)?  $default,){
final _that = this;
switch (_that) {
case _AppleLoginRequest() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String identityToken, @JsonKey(required: true)  String nonce, @JsonKey(includeIfNull: false)  String? fullName)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AppleLoginRequest() when $default != null:
return $default(_that.identityToken,_that.nonce,_that.fullName);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String identityToken, @JsonKey(required: true)  String nonce, @JsonKey(includeIfNull: false)  String? fullName)  $default,) {final _that = this;
switch (_that) {
case _AppleLoginRequest():
return $default(_that.identityToken,_that.nonce,_that.fullName);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String identityToken, @JsonKey(required: true)  String nonce, @JsonKey(includeIfNull: false)  String? fullName)?  $default,) {final _that = this;
switch (_that) {
case _AppleLoginRequest() when $default != null:
return $default(_that.identityToken,_that.nonce,_that.fullName);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _AppleLoginRequest implements AppleLoginRequest {
  const _AppleLoginRequest({@JsonKey(required: true) required this.identityToken, @JsonKey(required: true) required this.nonce, @JsonKey(includeIfNull: false) this.fullName});
  factory _AppleLoginRequest.fromJson(Map<String, dynamic> json) => _$AppleLoginRequestFromJson(json);

@override@JsonKey(required: true) final  String identityToken;
@override@JsonKey(required: true) final  String nonce;
/// Apple only delivers the name on the first sign-in; forward it then.
@override@JsonKey(includeIfNull: false) final  String? fullName;

/// Create a copy of AppleLoginRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AppleLoginRequestCopyWith<_AppleLoginRequest> get copyWith => __$AppleLoginRequestCopyWithImpl<_AppleLoginRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AppleLoginRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AppleLoginRequest&&(identical(other.identityToken, identityToken) || other.identityToken == identityToken)&&(identical(other.nonce, nonce) || other.nonce == nonce)&&(identical(other.fullName, fullName) || other.fullName == fullName));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,identityToken,nonce,fullName);

@override
String toString() {
  return 'AppleLoginRequest(identityToken: $identityToken, nonce: $nonce, fullName: $fullName)';
}


}

/// @nodoc
abstract mixin class _$AppleLoginRequestCopyWith<$Res> implements $AppleLoginRequestCopyWith<$Res> {
  factory _$AppleLoginRequestCopyWith(_AppleLoginRequest value, $Res Function(_AppleLoginRequest) _then) = __$AppleLoginRequestCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String identityToken,@JsonKey(required: true) String nonce,@JsonKey(includeIfNull: false) String? fullName
});




}
/// @nodoc
class __$AppleLoginRequestCopyWithImpl<$Res>
    implements _$AppleLoginRequestCopyWith<$Res> {
  __$AppleLoginRequestCopyWithImpl(this._self, this._then);

  final _AppleLoginRequest _self;
  final $Res Function(_AppleLoginRequest) _then;

/// Create a copy of AppleLoginRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? identityToken = null,Object? nonce = null,Object? fullName = freezed,}) {
  return _then(_AppleLoginRequest(
identityToken: null == identityToken ? _self.identityToken : identityToken // ignore: cast_nullable_to_non_nullable
as String,nonce: null == nonce ? _self.nonce : nonce // ignore: cast_nullable_to_non_nullable
as String,fullName: freezed == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$SocialAuthResponse {

@JsonKey(required: true) String get accessToken;@JsonKey(required: true) String get refreshToken;@JsonKey(required: true) String get tokenType;@JsonKey(required: true) int get expiresIn;@JsonKey(required: true) UserSummary get user;/// Profile fields to collect next: `email` and/or `phone`. Empty when the profile is complete.
@JsonKey(required: true) List<String> get needsProfileCompletion;
/// Create a copy of SocialAuthResponse
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SocialAuthResponseCopyWith<SocialAuthResponse> get copyWith => _$SocialAuthResponseCopyWithImpl<SocialAuthResponse>(this as SocialAuthResponse, _$identity);

  /// Serializes this SocialAuthResponse to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SocialAuthResponse&&(identical(other.accessToken, accessToken) || other.accessToken == accessToken)&&(identical(other.refreshToken, refreshToken) || other.refreshToken == refreshToken)&&(identical(other.tokenType, tokenType) || other.tokenType == tokenType)&&(identical(other.expiresIn, expiresIn) || other.expiresIn == expiresIn)&&(identical(other.user, user) || other.user == user)&&const DeepCollectionEquality().equals(other.needsProfileCompletion, needsProfileCompletion));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,accessToken,refreshToken,tokenType,expiresIn,user,const DeepCollectionEquality().hash(needsProfileCompletion));

@override
String toString() {
  return 'SocialAuthResponse(accessToken: $accessToken, refreshToken: $refreshToken, tokenType: $tokenType, expiresIn: $expiresIn, user: $user, needsProfileCompletion: $needsProfileCompletion)';
}


}

/// @nodoc
abstract mixin class $SocialAuthResponseCopyWith<$Res>  {
  factory $SocialAuthResponseCopyWith(SocialAuthResponse value, $Res Function(SocialAuthResponse) _then) = _$SocialAuthResponseCopyWithImpl;
@useResult
$Res call({
@JsonKey(required: true) String accessToken,@JsonKey(required: true) String refreshToken,@JsonKey(required: true) String tokenType,@JsonKey(required: true) int expiresIn,@JsonKey(required: true) UserSummary user,@JsonKey(required: true) List<String> needsProfileCompletion
});


$UserSummaryCopyWith<$Res> get user;

}
/// @nodoc
class _$SocialAuthResponseCopyWithImpl<$Res>
    implements $SocialAuthResponseCopyWith<$Res> {
  _$SocialAuthResponseCopyWithImpl(this._self, this._then);

  final SocialAuthResponse _self;
  final $Res Function(SocialAuthResponse) _then;

/// Create a copy of SocialAuthResponse
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? accessToken = null,Object? refreshToken = null,Object? tokenType = null,Object? expiresIn = null,Object? user = null,Object? needsProfileCompletion = null,}) {
  return _then(_self.copyWith(
accessToken: null == accessToken ? _self.accessToken : accessToken // ignore: cast_nullable_to_non_nullable
as String,refreshToken: null == refreshToken ? _self.refreshToken : refreshToken // ignore: cast_nullable_to_non_nullable
as String,tokenType: null == tokenType ? _self.tokenType : tokenType // ignore: cast_nullable_to_non_nullable
as String,expiresIn: null == expiresIn ? _self.expiresIn : expiresIn // ignore: cast_nullable_to_non_nullable
as int,user: null == user ? _self.user : user // ignore: cast_nullable_to_non_nullable
as UserSummary,needsProfileCompletion: null == needsProfileCompletion ? _self.needsProfileCompletion : needsProfileCompletion // ignore: cast_nullable_to_non_nullable
as List<String>,
  ));
}
/// Create a copy of SocialAuthResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$UserSummaryCopyWith<$Res> get user {
  
  return $UserSummaryCopyWith<$Res>(_self.user, (value) {
    return _then(_self.copyWith(user: value));
  });
}
}


/// Adds pattern-matching-related methods to [SocialAuthResponse].
extension SocialAuthResponsePatterns on SocialAuthResponse {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SocialAuthResponse value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SocialAuthResponse() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SocialAuthResponse value)  $default,){
final _that = this;
switch (_that) {
case _SocialAuthResponse():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SocialAuthResponse value)?  $default,){
final _that = this;
switch (_that) {
case _SocialAuthResponse() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String accessToken, @JsonKey(required: true)  String refreshToken, @JsonKey(required: true)  String tokenType, @JsonKey(required: true)  int expiresIn, @JsonKey(required: true)  UserSummary user, @JsonKey(required: true)  List<String> needsProfileCompletion)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SocialAuthResponse() when $default != null:
return $default(_that.accessToken,_that.refreshToken,_that.tokenType,_that.expiresIn,_that.user,_that.needsProfileCompletion);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(required: true)  String accessToken, @JsonKey(required: true)  String refreshToken, @JsonKey(required: true)  String tokenType, @JsonKey(required: true)  int expiresIn, @JsonKey(required: true)  UserSummary user, @JsonKey(required: true)  List<String> needsProfileCompletion)  $default,) {final _that = this;
switch (_that) {
case _SocialAuthResponse():
return $default(_that.accessToken,_that.refreshToken,_that.tokenType,_that.expiresIn,_that.user,_that.needsProfileCompletion);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(required: true)  String accessToken, @JsonKey(required: true)  String refreshToken, @JsonKey(required: true)  String tokenType, @JsonKey(required: true)  int expiresIn, @JsonKey(required: true)  UserSummary user, @JsonKey(required: true)  List<String> needsProfileCompletion)?  $default,) {final _that = this;
switch (_that) {
case _SocialAuthResponse() when $default != null:
return $default(_that.accessToken,_that.refreshToken,_that.tokenType,_that.expiresIn,_that.user,_that.needsProfileCompletion);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SocialAuthResponse implements SocialAuthResponse {
  const _SocialAuthResponse({@JsonKey(required: true) required this.accessToken, @JsonKey(required: true) required this.refreshToken, @JsonKey(required: true) required this.tokenType, @JsonKey(required: true) required this.expiresIn, @JsonKey(required: true) required this.user, @JsonKey(required: true) required final  List<String> needsProfileCompletion}): _needsProfileCompletion = needsProfileCompletion;
  factory _SocialAuthResponse.fromJson(Map<String, dynamic> json) => _$SocialAuthResponseFromJson(json);

@override@JsonKey(required: true) final  String accessToken;
@override@JsonKey(required: true) final  String refreshToken;
@override@JsonKey(required: true) final  String tokenType;
@override@JsonKey(required: true) final  int expiresIn;
@override@JsonKey(required: true) final  UserSummary user;
/// Profile fields to collect next: `email` and/or `phone`. Empty when the profile is complete.
 final  List<String> _needsProfileCompletion;
/// Profile fields to collect next: `email` and/or `phone`. Empty when the profile is complete.
@override@JsonKey(required: true) List<String> get needsProfileCompletion {
  if (_needsProfileCompletion is EqualUnmodifiableListView) return _needsProfileCompletion;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_needsProfileCompletion);
}


/// Create a copy of SocialAuthResponse
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SocialAuthResponseCopyWith<_SocialAuthResponse> get copyWith => __$SocialAuthResponseCopyWithImpl<_SocialAuthResponse>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SocialAuthResponseToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SocialAuthResponse&&(identical(other.accessToken, accessToken) || other.accessToken == accessToken)&&(identical(other.refreshToken, refreshToken) || other.refreshToken == refreshToken)&&(identical(other.tokenType, tokenType) || other.tokenType == tokenType)&&(identical(other.expiresIn, expiresIn) || other.expiresIn == expiresIn)&&(identical(other.user, user) || other.user == user)&&const DeepCollectionEquality().equals(other._needsProfileCompletion, _needsProfileCompletion));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,accessToken,refreshToken,tokenType,expiresIn,user,const DeepCollectionEquality().hash(_needsProfileCompletion));

@override
String toString() {
  return 'SocialAuthResponse(accessToken: $accessToken, refreshToken: $refreshToken, tokenType: $tokenType, expiresIn: $expiresIn, user: $user, needsProfileCompletion: $needsProfileCompletion)';
}


}

/// @nodoc
abstract mixin class _$SocialAuthResponseCopyWith<$Res> implements $SocialAuthResponseCopyWith<$Res> {
  factory _$SocialAuthResponseCopyWith(_SocialAuthResponse value, $Res Function(_SocialAuthResponse) _then) = __$SocialAuthResponseCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(required: true) String accessToken,@JsonKey(required: true) String refreshToken,@JsonKey(required: true) String tokenType,@JsonKey(required: true) int expiresIn,@JsonKey(required: true) UserSummary user,@JsonKey(required: true) List<String> needsProfileCompletion
});


@override $UserSummaryCopyWith<$Res> get user;

}
/// @nodoc
class __$SocialAuthResponseCopyWithImpl<$Res>
    implements _$SocialAuthResponseCopyWith<$Res> {
  __$SocialAuthResponseCopyWithImpl(this._self, this._then);

  final _SocialAuthResponse _self;
  final $Res Function(_SocialAuthResponse) _then;

/// Create a copy of SocialAuthResponse
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? accessToken = null,Object? refreshToken = null,Object? tokenType = null,Object? expiresIn = null,Object? user = null,Object? needsProfileCompletion = null,}) {
  return _then(_SocialAuthResponse(
accessToken: null == accessToken ? _self.accessToken : accessToken // ignore: cast_nullable_to_non_nullable
as String,refreshToken: null == refreshToken ? _self.refreshToken : refreshToken // ignore: cast_nullable_to_non_nullable
as String,tokenType: null == tokenType ? _self.tokenType : tokenType // ignore: cast_nullable_to_non_nullable
as String,expiresIn: null == expiresIn ? _self.expiresIn : expiresIn // ignore: cast_nullable_to_non_nullable
as int,user: null == user ? _self.user : user // ignore: cast_nullable_to_non_nullable
as UserSummary,needsProfileCompletion: null == needsProfileCompletion ? _self._needsProfileCompletion : needsProfileCompletion // ignore: cast_nullable_to_non_nullable
as List<String>,
  ));
}

/// Create a copy of SocialAuthResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$UserSummaryCopyWith<$Res> get user {
  
  return $UserSummaryCopyWith<$Res>(_self.user, (value) {
    return _then(_self.copyWith(user: value));
  });
}
}

// dart format on
