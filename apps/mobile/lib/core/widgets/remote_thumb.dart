import 'package:flutter/material.dart';

/// Small network image with a soft fallback when URL is null/broken.
class RemoteThumb extends StatelessWidget {
  const RemoteThumb({
    super.key,
    this.url,
    this.size = 48,
    this.radius = 10,
    this.icon = Icons.image_outlined,
  });

  final String? url;
  final double size;
  final double radius;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final border = BorderRadius.circular(radius);
    final fallback = ColoredBox(
      color: Theme.of(context).colorScheme.surfaceVariant,
      child: Icon(icon, size: size * 0.42),
    );

    if (url == null || url!.trim().isEmpty) {
      return ClipRRect(
        borderRadius: border,
        child: SizedBox(width: size, height: size, child: fallback),
      );
    }

    return ClipRRect(
      borderRadius: border,
      child: Image.network(
        url!,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) =>
            SizedBox(width: size, height: size, child: fallback),
        loadingBuilder: (context, child, progress) {
          if (progress == null) return child;
          return SizedBox(
            width: size,
            height: size,
            child: const Center(
              child: SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          );
        },
      ),
    );
  }
}
