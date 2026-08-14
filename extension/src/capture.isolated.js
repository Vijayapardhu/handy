// Isolated-world content script on info.aec.edu.in — has chrome.runtime and
// DOM access. Listens for the same-origin postMessage sent by capture.main.js
// (the MAIN-world script that observes the page's own fetch/XHR calls),
// normalizes it with HandyParser (from parser.js, loaded just before this
// file — see manifest.json), and forwards only the normalized snapshot to
// the background service worker for storage.
(() => {
  console.log(
    "[Handy] isolated relay loading in frame:",
    window.location.href,
    "HandyParser loaded:",
    Boolean(self.HandyParser),
  );

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;

    const data = event.data;
    if (!data || data.__handySync !== true || data.type !== "CAPTURED_RESPONSE") return;

    console.log("[Handy] isolated relay received captured response for", data.url);

    // Two different endpoints reach this listener (see TARGET_PATTERNS in
    // capture.main.js) and their envelopes carry different payloads, so route
    // on the URL rather than trying each parser in turn.
    if (/ShowTimeTables/i.test(data.url)) {
      const timetable = self.HandyParser?.parseTimetableResponse(data.body, data.url, data.capturedAt);
      if (!timetable) {
        console.log("[Handy] parseTimetableResponse returned null — unexpected shape:", data.body.slice(0, 300));
        return;
      }
      console.log("[Handy] parsed timetable, sending to background:", timetable.name, timetable.slots.length, "slots");
      chrome.runtime.sendMessage({ type: "CAPTURE_TIMETABLE", timetable }).catch((e) => {
        console.log("[Handy] sendMessage to background failed:", e);
      });
      return;
    }

    const snapshot = self.HandyParser?.parseProfileResponse(data.body, data.url, data.capturedAt);
    if (!snapshot) {
      console.log("[Handy] parseProfileResponse returned null — response body did not match the expected shape:", data.body.slice(0, 300));
      return;
    }

    console.log("[Handy] parsed snapshot, sending to background:", snapshot.rollNumber, snapshot.attendance.subjects.length, "subjects");
    chrome.runtime.sendMessage({ type: "CAPTURE_SNAPSHOT", snapshot }).catch((e) => {
      console.log("[Handy] sendMessage to background failed:", e);
    });
  });
})();
