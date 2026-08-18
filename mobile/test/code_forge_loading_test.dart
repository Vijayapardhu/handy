import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:handy/widgets/code_forge_loading.dart';

/// The loading state, in both layouts it is used in.
///
/// Worth a widget test rather than a look, because the way this breaks is not
/// cosmetic: the skeleton uses a Spacer to push its bar to the bottom of the
/// fixed-height card on Today, and a Spacer inside an unbounded scrolling list
/// throws. Analysis cannot see it and a glance at a working screen cannot
/// either — it only shows up in the layout the author did not happen to open.
void main() {
  Widget hosted(Widget child) => MaterialApp(
        home: Scaffold(body: child),
        theme: ThemeData(colorScheme: const ColorScheme.light(primary: Color(0xFFF97316))),
      );

  testWidgets('fills a bounded height without overflowing', (tester) async {
    // The Today screen's arrangement: a fixed-height box, as the swiper gives.
    await tester.pumpWidget(hosted(
      const SizedBox(height: 208, child: CodeForgeCardSkeleton(fill: true)),
    ));
    await tester.pump(const Duration(milliseconds: 600));

    expect(tester.takeException(), isNull);
    expect(find.text('CODEFORGE ATTENDANCE'), findsOneWidget);
    expect(find.text('Signing in to Maya…'), findsOneWidget);
  });

  testWidgets('sizes itself inside a scrolling list', (tester) async {
    // The breakdown screen's arrangement. With fill: true this throws, which is
    // the mistake this test exists to catch.
    await tester.pumpWidget(hosted(
      ListView(children: const [CodeForgeCardSkeleton()]),
    ));
    await tester.pump(const Duration(milliseconds: 600));

    expect(tester.takeException(), isNull);
    expect(find.text('CODEFORGE ATTENDANCE'), findsOneWidget);
  });

  testWidgets('the screen skeleton lays out in a list', (tester) async {
    await tester.pumpWidget(hosted(
      ListView(children: const [CodeForgeScreenSkeleton()]),
    ));
    await tester.pump(const Duration(milliseconds: 600));

    expect(tester.takeException(), isNull);
  });

  testWidgets('animates, and keeps animating', (tester) async {
    await tester.pumpWidget(hosted(
      const SizedBox(height: 208, child: CodeForgeCardSkeleton(fill: true)),
    ));
    // Several sweeps and blinks. A controller left un-repeated, or disposed
    // while still driving, surfaces here rather than on a student's phone.
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 500));
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('stands still for a phone with animations turned off', (tester) async {
    // Same layout, no motion — the wait stays legible either way.
    await tester.pumpWidget(MaterialApp(
      home: MediaQuery(
        data: const MediaQueryData(disableAnimations: true),
        child: const Scaffold(
          body: SizedBox(height: 208, child: CodeForgeCardSkeleton(fill: true)),
        ),
      ),
    ));
    await tester.pump(const Duration(milliseconds: 600));

    expect(tester.takeException(), isNull);
    expect(find.text('Signing in to Maya…'), findsOneWidget);
  });

  testWidgets('disposes cleanly when it goes away mid-animation', (tester) async {
    // The real sequence: the figures land and the skeleton is replaced while
    // its controllers are still running.
    await tester.pumpWidget(hosted(
      const SizedBox(height: 208, child: CodeForgeCardSkeleton(fill: true)),
    ));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpWidget(hosted(const SizedBox(height: 208)));
    await tester.pump(const Duration(milliseconds: 300));

    expect(tester.takeException(), isNull);
  });
}
