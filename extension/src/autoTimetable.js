// Runs on the portal's timetable page and picks a timetable, so the student
// never has to go looking for it themselves.
//
// The timetable only reaches the network when something on
// studenttimetableoption.aspx is chosen — the page doesn't fetch it on load —
// so a capture-only extension would wait forever. background.js opens this
// page in a background tab and sets `handy:autoTimetablePending`; that flag is
// what authorises the clicking below. Without it this script does nothing, so
// it can never hijack a page the student opened for themselves.
//
// This is an ASP.NET WebForms page whose control ids are generated, so the
// selection below is heuristic: any <select> that looks like a timetable
// chooser, then any button that looks like "show". If the page ever changes
// shape, attempt() gives up with a warning after ten tries — and the student
// can still pick a timetable by hand in the tab that stays open.
(() => {
  const PAGE_PATTERN = /studenttimetableoption\.aspx/i;
  const AUTO_FLAG = "handy:autoTimetablePending";
  const SHOW_BUTTON = /show|view|display|submit|get|timetable/i;

  if (!PAGE_PATTERN.test(window.location.href)) return;

  chrome.storage.local.get(AUTO_FLAG).then(({ [AUTO_FLAG]: pending }) => {
    if (!pending) return; // The student opened this page themselves — stay passive.
    // WebForms hydrates its controls after load; retry rather than assuming
    // the page is ready the moment this script runs.
    attempt(0);
  });

  function attempt(tries) {
    if (tries > 10) {
      console.warn("[Handy] gave up auto-selecting a timetable — no usable control found");
      return;
    }
    if (selectTimetable()) return;
    setTimeout(() => attempt(tries + 1), 500);
  }

  function selectTimetable() {
    // A dropdown of timetables: pick the first real option (index 0 is
    // typically "-- Select --") and let its postback fire.
    for (const select of document.querySelectorAll("select")) {
      const options = [...select.options].filter((o) => o.value && o.value !== "0" && o.value !== "-1");
      if (options.length === 0) continue;

      if (select.value !== options[0].value) {
        select.value = options[0].value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }

      // A dropdown with an auto-postback needs nothing more; one without it
      // needs the button below, so fall through and try that too.
      if (clickShowButton()) return true;
      return true;
    }

    return clickShowButton();
  }

  function clickShowButton() {
    const candidates = [
      ...document.querySelectorAll("input[type=submit], input[type=button], button, a[href*='doPostBack']"),
    ];
    const button = candidates.find((el) => SHOW_BUTTON.test(el.value || el.textContent || ""));
    if (!button) return false;

    button.click();
    return true;
  }
})();
