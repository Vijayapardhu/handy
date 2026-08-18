/**
 * Every URL and version number the landing page quotes, in one place.
 *
 * Shipping a new build should be a one-line edit here — the page reads these
 * and nothing else hardcodes a release URL. The artifacts these point at are
 * created outside this repo (a GitHub release), so a value can be correct here
 * and still 404 until the release is published; keep the two in step.
 */

const REPO = "https://github.com/Vijayapardhu/handy";

/**
 * Both downloads use GitHub's `/releases/latest/download/<name>` alias
 * rather than a pinned tag. A pinned tag (what this used to do) goes stale
 * the moment a new release ships under a different tag — which is exactly
 * how both links ended up 404ing at once, silently, until this was
 * next checked by hand. `latest` always resolves to whatever the newest
 * non-draft, non-prerelease release actually is, so it can't drift out of
 * step the way a hardcoded tag can. The two filenames below (`handy.apk`,
 * `handy-unpacked.zip`) are the one thing that still has to stay correct:
 * whatever release process cuts the next one has to attach the asset under
 * that exact stable name, not a versioned one.
 */
export const ANDROID = {
  url: `${REPO}/releases/latest/download/handy.apk`,
  version: "1.0.4",
  /** Shown next to the button so nobody starts a download blind. */
  size: "59 MB",
  minAndroid: "Android 6.0",
  releasedOn: "August 2026",
} as const;

export const EXTENSION = {
  /** extension/tool/pack.mjs always names its output `handy-unpacked.zip`, regardless of version — the file to attach to a release. */
  url: `${REPO}/releases/latest/download/handy-unpacked.zip`,
  version: "1.0.1",
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
