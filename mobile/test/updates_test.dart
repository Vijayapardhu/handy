import 'package:flutter_test/flutter_test.dart';
import 'package:handy/data/updates.dart';

void main() {
  group('compareVersions', () {
    test('orders by number, not by string', () {
      // The case that makes this worth having. Compared as text, '1.10.0'
      // sorts before '1.9.0' — so the release that fixes something looks older
      // than the one that broke it, and nobody is ever prompted to update.
      expect(Updates.compareVersions('1.10.0', '1.9.0'), greaterThan(0));
      expect(Updates.compareVersions('1.9.0', '1.10.0'), lessThan(0));
      expect(Updates.compareVersions('2.0.0', '10.0.0'), lessThan(0));
    });

    test('treats equal versions as equal', () {
      expect(Updates.compareVersions('1.2.3', '1.2.3'), 0);
    });

    test('pads missing parts with zero', () {
      expect(Updates.compareVersions('1.2', '1.2.0'), 0);
      expect(Updates.compareVersions('1.2', '1.2.1'), lessThan(0));
      expect(Updates.compareVersions('2', '1.9.9'), greaterThan(0));
    });

    test('does not mistake a patch bump for a major one', () {
      expect(Updates.compareVersions('1.0.1', '1.0.0'), greaterThan(0));
      expect(Updates.compareVersions('1.0.0', '1.1.0'), lessThan(0));
    });

    test('survives junk rather than throwing', () {
      // A published version is typed by a human in the admin panel. A stray
      // 'v' or a blank should mean "not newer", not a crash on launch.
      expect(Updates.compareVersions('', '1.0.0'), lessThan(0));
      expect(Updates.compareVersions('v1.0.0', '1.0.0'), 0);
      expect(Updates.compareVersions('1.0.0-beta', '1.0.0'), 0);
    });
  });
}
