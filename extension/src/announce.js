/**
 * Tells the Handy web app which extension ID to talk to.
 *
 * The web app reaches the extension with chrome.runtime.sendMessage(id, ...),
 * which needs the id up front. That was hardcoded, which worked only because
 * manifest.json pins the key and therefore the ID — and that pin holds for
 * unpacked and self-hosted builds only. A store assigns its own ID: the same
 * extension published to Edge Add-ons gets a different one, and a hardcoded ID
 * would leave it installed but unreachable, with the web app quietly reporting
 * "extension not available" forever.
 *
 * So the extension states its own ID rather than the page assuming it. This
 * runs on Handy's own origins (see manifest matches), writes one attribute,
 * and does nothing else.
 *
 * The attribute is not a trust signal and the web app must not treat it as
 * one — any script on the page could set it. All it does is name a messaging
 * endpoint, and the browser still enforces externally_connectable on the other
 * side, so a wrong value gets a rejected send, not a leak.
 */
document.documentElement.dataset.handyExtension = chrome.runtime.id;
