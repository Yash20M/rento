import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/location/location_service.dart';
import '../../../l10n/generated/app_localizations.dart';
import '../application/explore_providers.dart';

Future<void> showLocationSheet(BuildContext context) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const LocationSheet(),
    );

/// Choose where to search: the device position, a demo place (non-production only) or typed coordinates.
class LocationSheet extends ConsumerStatefulWidget {
  const LocationSheet({super.key});

  @override
  ConsumerState<LocationSheet> createState() => _LocationSheetState();
}

class _LocationSheetState extends ConsumerState<LocationSheet> {
  final _lat = TextEditingController();
  final _lng = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _lat.dispose();
    _lng.dispose();
    super.dispose();
  }

  void _use(LocationChoice choice) {
    ref.read(locationChoiceProvider.notifier).choose(choice);
    Navigator.of(context).pop();
  }

  Future<void> _useMyLocation() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final point = await ref.read(locationServiceProvider).current();
      if (!mounted) return;
      _use(LocationChoice(point: point));
    } on LocationException catch (error) {
      if (!mounted) return;
      setState(
        () =>
            _error = switch (error.failure) {
              LocationFailure.servicesOff => l10n.locationServicesOff,
              LocationFailure.denied => l10n.locationDenied,
              LocationFailure.deniedForever => l10n.locationDeniedForever,
              LocationFailure.unavailable => l10n.locationUnavailable,
            },
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _useTyped() {
    final l10n = AppLocalizations.of(context);
    final lat = double.tryParse(_lat.text.trim());
    final lng = double.tryParse(_lng.text.trim());
    if (lat == null ||
        lng == null ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180) {
      setState(() => _error = l10n.coordinatesInvalid);
      return;
    }
    _use(LocationChoice(point: GeoPoint(latitude: lat, longitude: lng)));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final env = ref.watch(envProvider);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        16,
        0,
        16,
        16 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              l10n.chooseLocationTitle,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              key: const Key('use-my-location'),
              onPressed: _busy ? null : _useMyLocation,
              icon: const Icon(Icons.my_location),
              label: Text(l10n.useMyLocation),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                key: const Key('location-error'),
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            if (!env.isProd) ...[
              const SizedBox(height: 16),
              Text(
                l10n.demoLocationsHeading,
                style: Theme.of(context).textTheme.titleSmall,
              ),
              for (final place in demoLocations)
                ListTile(
                  key: Key('demo-${place.name}'),
                  leading: const Icon(Icons.place_outlined),
                  title: Text(place.name),
                  onTap:
                      () => _use(
                        LocationChoice(
                          name: place.name,
                          point: GeoPoint(
                            latitude: place.latitude,
                            longitude: place.longitude,
                          ),
                        ),
                      ),
                ),
            ],
            const SizedBox(height: 16),
            Text(
              l10n.enterCoordinates,
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    key: const Key('lat-field'),
                    controller: _lat,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                      signed: true,
                    ),
                    decoration: InputDecoration(labelText: l10n.latitudeLabel),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    key: const Key('lng-field'),
                    controller: _lng,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                      signed: true,
                    ),
                    decoration: InputDecoration(labelText: l10n.longitudeLabel),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              key: const Key('search-here'),
              onPressed: _useTyped,
              child: Text(l10n.searchHere),
            ),
          ],
        ),
      ),
    );
  }
}
