// Runs in the PAGE's own JS context (world: "MAIN", see manifest.json) on
// info.aec.edu.in. This never touches login forms or credentials — it only
// observes responses the page's own already-authenticated session requests,
// after the student has signed in themselves through the site's normal
// (Cloudflare-protected) login flow. It just watches fetch/XHR traffic the
// page already makes and relays matching response bodies to the isolated
// content script via postMessage (same-origin only).
(() => {
  console.log("[Handy] main-world hook loading in frame:", window.location.href);
  // ShowStudentProfileNew -> bio-data + attendance (HTML in the envelope).
  // ShowTimeTables       -> the weekly timetable (JSON in the envelope).
  const TARGET_PATTERNS = [/ShowStudentProfileNew/i, /ShowTimeTables/i];

  function isTarget(url) {
    return typeof url === "string" && TARGET_PATTERNS.some((re) => re.test(url));
  }

  function emit(url, bodyText) {
    console.log("[Handy] emitting captured response for", url, "(", bodyText.length, "chars )");
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
      try {
        const requestUrl = typeof args[0] === "string" ? args[0] : args[0]?.url;
        if (isTarget(requestUrl)) {
          console.log("[Handy] fetch matched target:", requestUrl);
          response
            .clone()
            .text()
            .then((text) => emit(requestUrl, text))
            .catch((e) => console.log("[Handy] fetch clone/text failed:", e));
        }
      } catch (e) {
        console.log("[Handy] fetch hook error:", e);
      }
      return response;
    };
    console.log("[Handy] fetch hook installed");
  } else {
    console.log("[Handy] window.fetch was not a function at install time — nothing hooked");
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
        if (isTarget(this.__handySyncUrl)) {
          console.log("[Handy] XHR matched target:", this.__handySyncUrl);
          emit(this.__handySyncUrl, this.responseText);
        }
      } catch (e) {
        console.log("[Handy] XHR hook error:", e);
      }
    });
    return originalSend.apply(this, args);
  };
  console.log("[Handy] XHR hook installed");
})();
