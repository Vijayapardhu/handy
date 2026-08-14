// Runs in the PAGE's own JS context (world: "MAIN", see manifest.json) on
// info.aec.edu.in. This never touches login forms or credentials — it only
// observes responses the page's own already-authenticated session requests,
// after the student has signed in themselves through the site's normal
// (Cloudflare-protected) login flow. It just watches fetch/XHR traffic the
// page already makes and relays matching response bodies to the isolated
// content script via postMessage (same-origin only).
(() => {
  // ShowStudentProfileNew -> bio-data + attendance (HTML in the envelope).
  // ShowTimeTables       -> the weekly timetable (JSON in the envelope).
  const TARGET_PATTERNS = [/ShowStudentProfileNew/i, /ShowTimeTables/i];

  function isTarget(url) {
    return typeof url === "string" && TARGET_PATTERNS.some((re) => re.test(url));
  }

  function emit(url, bodyText) {
    window.postMessage(
      {
        __handySync: true,
        type: "CAPTURED_RESPONSE",
        url,
        body: bodyText,
        capturedAt: new Date().toISOString(),
      },
      window.location.origin,
    );
  }

  const originalFetch = window.fetch;
  if (typeof originalFetch === "function") {
    window.fetch = async function handyFetch(...args) {
      const response = await originalFetch.apply(this, args);
      // Anything that goes wrong in here is ours, and must never reach the
      // page — the student is using this site, and a broken fetch would break
      // it. Warn (rare, and the only clue if capture silently stops) and let
      // the original response through untouched.
      try {
        const requestUrl = typeof args[0] === "string" ? args[0] : args[0]?.url;
        if (isTarget(requestUrl)) {
          response
            .clone()
            .text()
            .then((text) => emit(requestUrl, text))
            .catch((e) => console.warn("[Handy] could not read response body:", e));
        }
      } catch (e) {
        console.warn("[Handy] fetch hook failed:", e);
      }
      return response;
    };
  }

  const OriginalXHR = window.XMLHttpRequest;
  const originalOpen = OriginalXHR.prototype.open;
  const originalSend = OriginalXHR.prototype.send;

  OriginalXHR.prototype.open = function handyOpen(method, url, ...rest) {
    this.__handySyncUrl = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  OriginalXHR.prototype.send = function handySend(...args) {
    this.addEventListener("load", function handyLoad() {
      try {
        if (isTarget(this.__handySyncUrl)) emit(this.__handySyncUrl, this.responseText);
      } catch (e) {
        console.warn("[Handy] XHR hook failed:", e);
      }
    });
    return originalSend.apply(this, args);
  };
})();
