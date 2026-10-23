import 'package:dio/dio.dart';

import 'api_exception.dart';
import 'models/models.dart';

/// Identity verification with Aadhaar (owner decision 2026-10-18: required before booking).
class KycApi {
  const KycApi(this._dio);

  final Dio _dio;

  Future<KycStatus> status() => guardApi(() async {
    final response = await _dio.get<Map<String, dynamic>>('/v1/me/kyc');
    return KycStatus.fromJson(response.data!);
  });

  /// Sends a one-time code to the phone linked to the Aadhaar. 422 = not a valid number; 409 `AADHAAR_IN_USE` =
  /// already verified on another account; 429 = too many attempts today.
  Future<AadhaarRequest> start(String aadhaarNumber) => guardApi(() async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/me/kyc/aadhaar',
      data: StartAadhaarRequest(aadhaarNumber: aadhaarNumber).toJson(),
    );
    return AadhaarRequest.fromJson(response.data!);
  });

  /// 422 on field `otp` = wrong or expired code (the message says how many attempts are left).
  Future<KycStatus> verify(String requestId, String otp) => guardApi(() async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/me/kyc/aadhaar/verify',
      data: VerifyAadhaarRequest(requestId: requestId, otp: otp).toJson(),
    );
    return KycStatus.fromJson(response.data!);
  });
}
