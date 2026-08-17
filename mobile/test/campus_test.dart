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

    test('routes AGBS management rolls by the program marker', () {
      // Same A9/P3 college code as AEC/ACET; the M (MBA) / E (MCA) marker at
      // index 5 is the only thing that separates them.
      for (final roll in ['23A91M0035', '22A91M0030', '14A91E0031', '18P31M0013']) {
        expect(detectCampus(roll), Campus.agbs, reason: roll);
      }
      // The B.Tech rolls with the same code stay put.
      expect(detectCampus('24A91A0501'), Campus.aec);
      expect(detectCampus('23P31A0341'), Campus.acet);
    });

    test('leaves AGBS admission numbers for the fallback, not detection', () {
      // Numeric and PGDM AGBS rolls match no college code.
      for (final roll in ['240218301030', '1884110070', '13PGDM005']) {
        expect(detectCampus(roll), isNull, reason: roll);
      }
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
      expect(Campus.agbs.usesPortalLogin, isTrue);
      // AUS never does — its portal enforces a captcha, so those students go
      // through the extension.
      expect(Campus.aus.usesPortalLogin, isFalse);
    });

    test('sends the campus name the API expects', () {
      expect(Campus.aus.wire, 'AUS');
      expect(Campus.aec.wire, 'AEC');
      expect(Campus.acet.wire, 'ACET');
      expect(Campus.agbs.wire, 'AGBS');
    });
  });

  group('fallbackCampus', () {
    test('tries AGBS for an unrecognised, non-AUS roll', () {
      // AGBS admission numbers match no college code, so this is the last
      // resort that lets the phone go straight to the portal password prompt.
      for (final roll in ['240218301030', '1884110070', '13PGDM005']) {
        expect(fallbackCampus(roll), Campus.agbs, reason: roll);
      }
    });

    test('never falls back to AGBS for an AUS-shaped roll', () {
      // AUS signs in through the extension with no portal password; a roll that
      // reads as AUS must not be sent to a portal login even when detection did
      // not fully pin it down.
      expect(fallbackCampus('AUS26-10819'), isNull);
      expect(fallbackCampus('26B21CS058'), isNull);
      // 'B' at the college-code position, but the digits did not match cleanly.
      expect(fallbackCampus('26BX1CS058'), isNull);
    });

    test('does not override a confident detection', () {
      // A roll detection already placed is returned by detectCampus, so the
      // fallback stays out of it.
      for (final roll in ['26B21CS058', '24A91A0501', '23P31A0341', '23A91M0035']) {
        expect(fallbackCampus(roll), isNull, reason: roll);
      }
    });

    test('waits until enough has been typed to judge', () {
      expect(fallbackCampus('240218'), isNull);
    });
  });
}
