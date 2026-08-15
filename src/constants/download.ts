/**
 * Every URL and version number the landing page quotes, in one place.
 *
 * Shipping a new build should be a one-line edit here — the page reads these
 * and nothing else hardcodes a release URL. The artifacts these point at are
 * created outside this repo (a GitHub release), so a value can be correct here
 * and still 404 until the release is published; keep the two in step.
 */

const REPO = "https://github.com/Vijayapardhu/handy";

/** Tag of the release the download buttons currently point at. */
const RELEASE_TAG = "v1.0.0";

export const ANDROID = {
  /** Release APK asset on the GitHub release. */
  url: `${REPO}/releases/download/${RELEASE_TAG}/handy-${RELEASE_TAG}.apk`,
  version: "1.0.0",
  /** Shown next to the button so nobody starts a download blind. */
  size: "24 MB",
  minAndroid: "Android 6.0",
  releasedOn: "August 2026",
} as const;

export const EXTENSION = {
  /** Zip of the `extension/` folder, loaded unpacked — it is not on the Web Store. */
  url: `${REPO}/releases/download/${RELEASE_TAG}/handy-college-sync-${RELEASE_TAG}.zip`,
  version: "1.0.0",
  /** Pinned in extension/manifest.json via an embedded public key. */
  id: "ledmfeohpnfmepdbncmcidoaflhijmkn",
} as const;

export const LINKS = {
  repo: REPO,
  releases: `${REPO}/releases`,
  issues: `${REPO}/issues`,
  webApp: "https://handy-aus.vercel.app",
  portal: "https://info.aec.edu.in/aus/",
  contactEmail: "vijaypardhu17@gmail.com",
} as const;
