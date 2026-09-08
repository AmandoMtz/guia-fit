import 'package:flutter/material.dart';
import '../models/campus.dart';

const fitOrange = Color(0xFFBD430B);
const fitNavy = Color(0xFF183543);
const fitMuted = Color(0xFF62717C);

class BrandHeader extends StatelessWidget {
  final bool compact;
  const BrandHeader({super.key, this.compact = false});
  @override
  Widget build(BuildContext context) {
    Widget logo(bool faculty) {
      final width = compact ? 110.0 : 135.0;
      final cropWidth = faculty ? 460.0 : 470.0;
      return Semantics(
        label: faculty
            ? 'Facultad de Ingeniería Tampico, 70 aniversario'
            : 'Universidad Autónoma de Tamaulipas',
        image: true,
        child: SizedBox(
          width: width,
          height: width * 224 / cropWidth,
          child: ClipRect(
            child: Stack(
              children: [
                Positioned(
                  left: -(faculty ? 1360 : 240) * width / cropWidth,
                  top: 0,
                  width: 2048 * width / cropWidth,
                  child: Image.asset(
                    'assets/logos.png',
                    excludeFromSemantics: true,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        logo(false),
        const SizedBox(width: 14),
        Container(width: 1, height: 34, color: const Color(0xFFE3E8EB)),
        const SizedBox(width: 14),
        logo(true),
      ],
    );
  }
}

class InfoBanner extends StatelessWidget {
  final String text;
  final bool error;
  const InfoBanner(this.text, {super.key, this.error = false});
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    margin: const EdgeInsets.symmetric(vertical: 12),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: error ? const Color(0xFFFFF4F3) : const Color(0xFFFFF8ED),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(
        color: error ? const Color(0xFFEFC4C1) : const Color(0xFFEBD2AE),
      ),
    ),
    child: Text(
      text,
      style: TextStyle(
        color: error ? const Color(0xFF962F26) : const Color(0xFF705026),
        fontSize: 14,
        height: 1.5,
      ),
    ),
  );
}

class VerificationBadge extends StatelessWidget {
  final bool verified;
  const VerificationBadge(this.verified, {super.key});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: verified ? const Color(0xFFECF8F0) : const Color(0xFFFFF8EA),
      borderRadius: BorderRadius.circular(6),
    ),
    child: Text(
      verified ? 'Verificado' : 'Por verificar',
      style: TextStyle(
        fontSize: 12,
        color: verified ? const Color(0xFF286342) : const Color(0xFF765014),
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}

class PlacePhoto extends StatelessWidget {
  final Place place;
  final double height;
  const PlacePhoto(this.place, {super.key, this.height = 120});
  @override
  Widget build(BuildContext context) {
    Widget empty() => Container(
      height: height,
      color: const Color(0xFFEAF0F4),
      child: const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.photo_outlined, color: fitMuted),
            SizedBox(height: 8),
            Text(
              'Fotografía pendiente',
              style: TextStyle(fontSize: 12, color: fitMuted),
            ),
          ],
        ),
      ),
    );
    return place.safePhoto == null
        ? empty()
        : Image.network(
            place.safePhoto!,
            height: height,
            width: double.infinity,
            fit: BoxFit.cover,
            semanticLabel: 'Entrada de ${place.name}',
            errorBuilder: (_, error, stack) => empty(),
          );
  }
}

class Surface extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  const Surface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(22),
  });
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: padding,
    margin: const EdgeInsets.only(bottom: 18),
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: const Color(0xFFE3E8EB)),
      borderRadius: BorderRadius.circular(16),
    ),
    child: child,
  );
}

void message(BuildContext context, String text) =>
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
