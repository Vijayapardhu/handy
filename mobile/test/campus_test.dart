import 'package:flutter_test/flutter_test.dart';
import 'package:handy/logic/campus.dart';

void main() {
  group('detectCampus', () {
    test('recognises every real AUS roll in the live database', () {
      // Not invented examples — these are the accounts that actually exist,
      // across two intakes, which is why the rule is B + two digits rather
      // than a fixed B11/B21.
      const real = [
        '25B11CS101',
        '25B11CS669',
        '25b11cs012',
        '26B21CS058',
        '26B21CS059',
        '26B21DS013',
        '26b21cs140',
        '26b21cs141',
        '26b21cs142',
      ];
      for (final roll in real) {
        expect(detectCampus(roll), Campus.aus, reason: roll);
      }
    });

    test('reads AUS admission numbers', () {
      expect(detectCampus('AUS26-10819'), Campus.aus);
    });

    test('recognises the observed AEC and ACET rolls', () {
      expect(detectCampus('24A91A0501'), Campus.aec);
      expect(detectCampus('23P31A0341'), Campus.acet);
    });

    test('does not decide on shape alone', () {
      // The seeded demo student has the identical shape to the AEC and ACET
      // rolls above and belongs to neither. A shape-based rule would send its
      // password to the wrong college's portal.
      expect(detectCampus('23A31A05B1'), isNull);
    });

    test('says it does not know rather than guessing', () {
      for (final roll in ['', 'X', '99Z99ZZ999', 'hello', '12345678']) {
        expect(detectCampus(roll), isNull, reason: roll);
      }
    });

    test('agrees with the web app on which campuses type a portal password', () {
      expect(Campus.aec.usesPortalLogin, isTrue);
      expect(Campus.acet.usesPortalLogin, isTrue);
      // AUS never does — its portal enforces a captcha, so those students go
      // through the extension.
      expect(Campus.aus.usesPortalLogin, isFalse);
    });

    test('sends the campus name the API expects', () {
      expect(Campus.aus.wire, 'AUS');
      expect(Campus.aec.wire, 'AEC');
      expect(Campus.acet.wire, 'ACET');
    });
  });
}
