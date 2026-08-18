/**
 * The student's photo from the college portal, derived from their roll
 * number rather than read off a stored field — the portal serves these at a
 * predictable path, so this works even for the (common) case where
 * `photoUrl` was never captured or synced to their Firestore doc.
 *
 * Mirrors mobile/lib/widgets/student_photo.dart, which found the pattern —
 * kept in step with it rather than reinvented, so a roll number resolves to
 * the same photo on both. https only: the portal's http form 404s.
 */
export function studentPhotoUrl(rollNumber: string | null | undefined): string | null {
  if (!rollNumber) return null;
  return `https://info.aec.edu.in/aus/studentPhotos_Original/${rollNumber.toUpperCase()}.jpg`;
}
