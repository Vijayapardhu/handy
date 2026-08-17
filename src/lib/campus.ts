/**
 * Which college a roll number belongs to.
 *
 * This decides whether a student is asked for a portal password at all, so
 * getting it wrong is not a cosmetic error: a misrouted guess sends an AEC
 * student's password to ACET's portal. That fails the login *and* puts a
 * credential somewhere it had no reason to go. So this reports "I don't know"
 * rather than picking the nearest match, and the UI asks in that case.
 *
 * The discriminator is the three characters at index 2–4 — the college code
 * that Andhra Pradesh engineering roll numbers embed. Shape alone cannot do it:
 * `23A31A05B1` (the seeded demo student) has exactly the same shape as
 * `24A91A0501` (AEC) and `23P31A0341` (ACET), and differs only in that code.
 *
 * Evidence behind each rule, so the next person can weigh it:
 *
 *   AUS  `B\d\d`  — strong. Ten real accounts in the live database, across two
 *                   intakes: 25B11CS101, 25B11CS669, 25b11cs012, 26B21CS058,
 *                   26B21CS059, 26B21DS013, 26b21cs140/141/142. The middle
 *                   digits move with the intake year, which is why this matches
 *                   B-then-two-digits rather than a fixed B11/B21.
 *   AEC  `A9\d`   — weak. One observed roll, 24A91A0501.
 *   ACET `P3\d`   — weak. One observed roll, 23P31A0341.
 *
 * The AEC and ACET rules rest on a single sample each. They are deliberately
 * narrow for that reason: a broader pattern would swallow roll numbers we have
 * never seen and route them somewhere on no evidence at all.
 *
 * AGBS (Aditya Global Business School) is the exception that forces a second
 * discriminator. It runs on the *same* Campus Connect portal but shares AEC's
 * JNTU college code (A9) and ACET's (P3) — an MBA roll `23A91M0035` has the
 * identical code slice to the AEC B.Tech roll above. What separates them is the
 * program marker at index 5: B.Tech rolls carry `A` there (`24A91A0501`), while
 * AGBS's management rolls carry `M` (MBA) or `E` (MCA) — e.g. 23A91M0035,
 * 23A91E00I8, 18P31M0013, 14A91E0031. That marker is strong: ~40 observed AGBS
 * rolls all show M/E, and every AEC/ACET B.Tech roll shows A. AGBS also issues
 * non-JNTU admission numbers (numeric like 240218301030 / 1884110070, or PGDM
 * like 13PGDM005); those match no code here and fall through to the picker,
 * which now offers AGBS.
 */
export type Campus = "AUS" | "AEC" | "ACET" | "AGBS";

export interface CampusGuess {
  campus: Campus | null;
  /**
   * False when nothing matched. The caller must ask rather than proceed —
   * see LoginPage, which reveals a two-option choice only in that case.
   */
  confident: boolean;
}

/** Campuses whose portal Handy can sign into server-side (no captcha). */
export const PORTAL_LOGIN_CAMPUSES: Campus[] = ["AEC", "ACET", "AGBS"];

export function usesPortalLogin(campus: Campus | null): boolean {
  return campus !== null && PORTAL_LOGIN_CAMPUSES.includes(campus);
}

export function detectCampus(rollNumber: string): CampusGuess {
  const roll = rollNumber.trim().toUpperCase();
  if (roll.length < 5) return { campus: null, confident: false };

  // Admission numbers rather than roll numbers — the portal issues these to
  // Aditya University students and they name the campus outright.
  if (/^AUS\d{2}-\d+$/.test(roll)) return { campus: "AUS", confident: true };

  const code = roll.slice(2, 5);

  // AGBS shares AEC's (A9) and ACET's (P3) college code; the program marker at
  // index 5 is what tells a management roll (M/E) from a B.Tech one (A). This is
  // checked before the B.Tech rules below so an AGBS roll is not swallowed by
  // them. Numeric/PGDM AGBS admission numbers match no code and fall through.
  const program = roll.charAt(5);
  if ((/^A9\d$/.test(code) || /^P3\d$/.test(code)) && (program === "M" || program === "E")) {
    return { campus: "AGBS", confident: true };
  }

  if (/^B\d{2}$/.test(code)) return { campus: "AUS", confident: true };
  if (/^A9\d$/.test(code)) return { campus: "AEC", confident: true };
  if (/^P3\d$/.test(code)) return { campus: "ACET", confident: true };

  // Includes the demo student's A31. Unknown is a real answer here.
  return { campus: null, confident: false };
}
