import 'dart:typed_data';

import 'package:image_picker/image_picker.dart';

enum PhotoSource { camera, gallery }

/// A picture chosen by the person: its bytes and its type (`image/jpeg`, `image/png` or `image/webp`).
class PickedPhoto {
  const PickedPhoto({required this.bytes, required this.contentType});

  final Uint8List bytes;
  final String contentType;
}

/// Asks the person for a photo. A seam so tests (and the emulator journeys) can hand over a picture without the
/// system camera or gallery.
abstract interface class PhotoPicker {
  /// `null` when the person backed out.
  Future<PickedPhoto?> pick(PhotoSource source);
}

class SystemPhotoPicker implements PhotoPicker {
  const SystemPhotoPicker();

  @override
  Future<PickedPhoto?> pick(PhotoSource source) async {
    final file = await ImagePicker().pickImage(
      source:
          source == PhotoSource.camera
              ? ImageSource.camera
              : ImageSource.gallery,
      // Profile photos are shown small: ask for a modest picture so the upload stays quick and under the limit.
      maxWidth: 1024,
      maxHeight: 1024,
      imageQuality: 85,
    );
    if (file == null) return null;
    final bytes = await file.readAsBytes();
    final name = file.name.toLowerCase();
    final type =
        file.mimeType ??
        (name.endsWith('.png')
            ? 'image/png'
            : name.endsWith('.webp')
            ? 'image/webp'
            : 'image/jpeg');
    return PickedPhoto(bytes: bytes, contentType: type);
  }
}
