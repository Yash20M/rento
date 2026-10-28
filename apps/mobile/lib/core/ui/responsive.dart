import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Layout helpers so every screen works from a 320 px phone to a wide desktop browser: content never stretches past a
/// readable width, and lists of cards become a grid when there is room.

/// The side padding that keeps content at most [maxWidth] wide and centred, never less than [min].
double contentInset(
  BuildContext context, {
  double maxWidth = 720,
  double min = 16,
}) => math.max(min, (MediaQuery.sizeOf(context).width - maxWidth) / 2);

/// Page padding for a scrolling screen: [contentInset] on the sides.
EdgeInsets pagePadding(
  BuildContext context, {
  double maxWidth = 720,
  double top = 12,
  double bottom = 24,
}) => EdgeInsets.fromLTRB(
  contentInset(context, maxWidth: maxWidth),
  top,
  contentInset(context, maxWidth: maxWidth),
  bottom,
);

/// How many columns of at least [minTileWidth] fit in [width] (1 on a phone).
int columnsFor(double width, {double minTileWidth = 320, int max = 3}) =>
    math.max(1, math.min(max, (width / minTileWidth).floor()));

/// Lays [children] out in equal-width columns as the space allows (one column on a phone). Children size themselves
/// vertically, so cards of different heights are fine.
class CardGrid extends StatelessWidget {
  const CardGrid({
    super.key,
    required this.children,
    this.minTileWidth = 320,
    this.maxColumns = 3,
    this.spacing = 16,
  });

  final List<Widget> children;
  final double minTileWidth;
  final int maxColumns;
  final double spacing;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      final cols = columnsFor(
        box.maxWidth,
        minTileWidth: minTileWidth,
        max: maxColumns,
      );
      if (cols == 1) return Column(children: children);
      final tile = (box.maxWidth - spacing * (cols - 1)) / cols;
      return Wrap(
        spacing: spacing,
        runSpacing: 0,
        children: [for (final c in children) SizedBox(width: tile, child: c)],
      );
    },
  );
}

/// How many product cards sit in a row: two on every phone, more as the window grows.
int productColumns(double width) {
  if (width < 600) return 2;
  if (width < 900) return 3;
  if (width < 1200) return 4;
  return 5;
}

/// Products in equal-width columns ([productColumns]); each card keeps its natural height, and a taller card does not
/// stretch its neighbour.
class ProductGrid extends StatelessWidget {
  const ProductGrid({
    super.key,
    required this.children,
    this.spacing = 12,
    this.runSpacing = 12,
  });

  final List<Widget> children;
  final double spacing;
  final double runSpacing;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      final columns = productColumns(MediaQuery.sizeOf(context).width);
      final tile = (box.maxWidth - spacing * (columns - 1)) / columns;
      return Wrap(
        spacing: spacing,
        runSpacing: runSpacing,
        children: [for (final c in children) SizedBox(width: tile, child: c)],
      );
    },
  );
}

/// Screen-width classes used by shells.
bool isWideLayout(BuildContext context) =>
    MediaQuery.sizeOf(context).width >= 900;
