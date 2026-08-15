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

/** Tag of the release the extension zip currently lives on — cut separately from the app's own RELEASE_TAG. */
const EXTENSION_RELEASE_TAG = "v1.0.0";

export const EXTENSION = {
  /**
   * extension/tool/pack.mjs always names its output `handy-unpacked.zip`
   * regardless of version — the file to attach to a release, per that
   * script's own instructions. Templating a version into this filename (as
   * this used to do) points at an asset that was never actually uploaded.
   */
  url: `${REPO}/releases/download/${EXTENSION_RELEASE_TAG}/handy-unpacked.zip`,
  version: "1.0.0",
  /** Pinned in extension/manifest.json via an embedded public key. */
  id: "ledmfeohpnfmepdbncmcidoaflhijmkn",
} as const;

export const LINKS = {
  repo: REPO,
  releases: `${REPO}/releases`,
  issues: `${REPO}/issues`,
  /**
   * The custom domain, matching extension/manifest.json's host_permissions and
   * externally_connectable, extension/popup/popup.js, and the Android app's
   * About screen.
   *
   * ⚠️ extension/src/config.js still points HANDY_URL at the old
   * handy-aus.vercel.app alias, so the two halves of the extension disagree
   * about where Handy lives. Worth reconciling — see the README's deployment
   * note for why the Vercel alias mattered.
   */
  webApp: "https://handy.vijayaapardhu.dev",
  portal: "https://info.aec.edu.in/aus/",

  // Developer. Mirrors the Android app's About screen — see Developer.tsx.
  portfolio: "https://vijayaapardhu.dev",
  github: "https://github.com/Vijayapardhu",
  contactEmail: "vijaypardhu17@gmail.com",
} as const;
