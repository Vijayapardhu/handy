// Isolated-world content script on info.aec.edu.in — has chrome.runtime and
// DOM access. Listens for the same-origin postMessage sent by capture.main.js
// (the MAIN-world script that observes the page's own fetch/XHR calls),
// normalizes it with HandyParser (from parser.js, loaded just before this
// file — see manifest.json), and forwards only the normalized snapshot to
// the background service worker for storage.
(() => {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;

    const data = event.data;
    if (!data || data.__handySync !== true || data.type !== "CAPTURED_RESPONSE") return;

    // Two different endpoints reach this listener (see TARGET_PATTERNS in
    // capture.main.js) and their envelopes carry different payloads, so route
    // on the URL rather than trying each parser in turn.
    //
    // A parser returning null means the portal changed shape and capture is
    // now silently broken, so it warns — but without the response body, which
    // is the student's own record and this console is shared with the page.
    if (/ShowTimeTables/i.test(data.url)) {
      const timetable = self.HandyParser?.parseTimetableResponse(data.body, data.url, data.capturedAt);
      if (!timetable) {
        console.warn("[Handy] could not parse the timetable response");
        return;
      }
      chrome.runtime.sendMessage({ type: "CAPTURE_TIMETABLE", timetable }).catch(() => {
        // Service worker asleep or the extension was reloaded mid-capture.
        // The next page load captures again; nothing is lost.
      });
      return;
    }

    const snapshot = self.HandyParser?.parseProfileResponse(data.body, data.url, data.capturedAt);
    if (!snapshot) {
      console.warn("[Handy] could not parse the profile response");
      return;
    }

    chrome.runtime.sendMessage({ type: "CAPTURE_SNAPSHOT", snapshot }).catch(() => {});
  });
})();
