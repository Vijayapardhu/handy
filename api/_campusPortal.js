// Logging into Campus Connect as a student, and reading back what it shows them.
//
// Ported from the Attendance Portal's working AEC/ACET controllers, which are
// the authority on this portal's behaviour — every endpoint, field name and
// selector below comes from code proven against the live site, not from a
// guess about how ASP.NET usually works.
//
// AUS is deliberately absent. Its portal enforces a domain-locked Cloudflare
// Turnstile server-side and returns 403 to anything that is not the college's
// own origin, so AUS students go through the browser extension instead — which
// never sees a password at all. See verify.js.
//
// Three deliberate departures from the reference:
//
//   1. node:crypto instead of crypto-js. Verified byte-identical output across
//      ASCII, Unicode and exact-block-boundary passwords, so it is a drop-in —
//      and it removes a dependency from a serverless bundle.
//   2. No writing response bodies to disk on an unknown layout. A serverless
//      filesystem is read-only, and an HTML dump of a logged-in portal page is
//      a student's data sitting in a file.
//   3. The password is never passed to the alerting path. The reference hands
//      it to sendDiscordAlert, which today ignores it — but a parameter that
//      exists is one edit away from being logged.
import { createCipheriv } from "node:crypto";
import * as cheerio from "cheerio";

/**
 * Per-campus differences. The login form field names are shared between AEC and
 * ACET; only the path and the image-button coordinates differ.
 *
 * `imgBtn2.x/.y` are the click coordinates of an <input type="image"> — ASP.NET
 * posts them instead of a button name, and omitting them means the server never
 * sees the click. The values are arbitrary points inside the image; they are
 * copied from the reference rather than invented so they stay inside whatever
 * bounds the portal expects.
 */
export const CAMPUSES = {
  AEC: { baseUrl: "https://info.aec.edu.in/aec/", btnX: 41, btnY: 24 },
  ACET: { baseUrl: "https://info.aec.edu.in/ACET/", btnX: 23, btnY: 6 },
  // Aditya Global Business School. Same Campus Connect portal, same login form
  // and AES key as AEC/ACET — only the path differs — so it drops in here with
  // no scraper changes beyond this line.
  AGBS: { baseUrl: "https://info.aec.edu.in/agbs/", btnX: 10, btnY: 10 },
};

/** Raised for a bad roll number or password, so the endpoint can answer 401 rather than 500. */
export class InvalidCredentialsError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

/**
 * The portal's own JavaScript encrypts the password before posting it, so the
 * server expects ciphertext rather than the password itself.
 *
 * The key is public — it is sitting in a script tag on the login page — so this
 * is not protecting anything; it just has to match. It lives in env because the
 * college has rotated it once already (8080… → 8701…), and when that happens
 * every login fails at once with a message that looks like "wrong password".
 */
function encryptPassword(password) {
  const key = (process.env.AES_KEY ?? "").slice(0, 16);
  const iv = (process.env.AES_IV ?? "").slice(0, 16);
  if (key.length !== 16 || iv.length !== 16) {
    throw new Error("AES_KEY/AES_IV must each be at least 16 characters");
  }
  const cipher = createCipheriv("aes-128-cbc", Buffer.from(key, "utf8"), Buffer.from(iv, "utf8"));
  return cipher.update(password, "utf8", "base64") + cipher.final("base64");
}

/** DD/MM/YYYY, which is the only format ShowAttendance accepts. */
function portalDate(date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

/**
 * A cookie jar and an HTTP client, on Node's built-in fetch.
 *
 * Deliberately not axios + axios-cookiejar-support, which is what the reference
 * uses: that chain pulls in http-cookie-agent → agent-base, and the bundle
 * Vercel builds crashes on it at load with ERR_REQUIRE_ESM before a single line
 * of this file runs. Rather than pin around somebody else's CJS/ESM mismatch,
 * this drops three dependencies for about twenty lines — the whole session is
 * one host, so a jar is a Map.
 *
 * Redirects are followed by default and only held back where a caller asks,
 * which is the login POST alone: its 302 *is* the success signal, so that one
 * has to be ours to inspect rather than something fetch quietly follows into a
 * page that no longer says what happened. Holding them back everywhere instead
 * is a quiet disaster — `default.aspx` redirects, so the login page arrives as
 * an empty 302 body, every hidden ASP.NET field reads as "", and the portal
 * answers the ensuing postback with a 500 that looks like it is about
 * credentials.
 */
function newClient() {
  const jar = new Map();

  function remember(response) {
    // getSetCookie keeps multiple Set-Cookie headers separate; a plain get()
    // joins them with commas and mangles any cookie containing one.
    const cookies = response.headers.getSetCookie?.() ?? [];
    for (const cookie of cookies) {
      const [pair] = cookie.split(";");
      const index = pair.indexOf("=");
      if (index <= 0) continue;
      jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }

  /**
   * Redirects are followed here rather than by fetch, because fetch does not
   * carry a cookie set mid-chain: the portal hands out ASP.NET_SessionId on the
   * first hop and expects it back on the next, and letting fetch follow instead
   * loops until it gives up with "redirect count exceeded". Every hop below
   * re-reads the jar, which is the whole reason this exists.
   */
  async function request(url, { method = "GET", body, headers = {}, follow = true } = {}) {
    let target = url;
    let verb = method;
    let payload = body;

    for (let hop = 0; ; hop++) {
      const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
      const response = await fetch(target, {
        method: verb,
        body: payload,
        redirect: "manual",
        headers: {
          "User-Agent": USER_AGENT,
          Origin: "https://info.aec.edu.in",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
        // A ceiling on every call: a serverless function that hangs on a slow
        // portal burns its whole budget and returns nothing.
        signal: AbortSignal.timeout(20000),
      });
      remember(response);

      const location = response.headers.get("location");
      const redirected = [301, 302, 303, 307, 308].includes(response.status);
      // Five is generous for a login flow; a portal asking for more is looping.
      if (!follow || !redirected || !location || hop >= 5) return response;

      target = new URL(location, target).href;
      // 301/302/303 turn a POST into a GET, which is what the browser does and
      // what the portal's own flow assumes. 307/308 preserve the method.
      if (response.status !== 307 && response.status !== 308) {
        verb = "GET";
        payload = undefined;
        headers = { ...headers };
        delete headers["Content-Type"];
      }
    }
  }

  return {
    /** The AuthToken cookie, which AUS's AJAX calls require as a header. */
    cookie: (name) => jar.get(name),
    get: (url, options) => request(url, options),
    post: (url, body, options) => request(url, { ...options, method: "POST", body }),
  };
}

/**
 * One ShowAttendance call. Empty dates mean "everything so far"; both dates set
 * to the same day means that day only — the filtering happens on the portal.
 */
async function fetchAttendance(client, baseUrl, fromDate, toDate, referer) {
  const subjects = [];
  let overall = { held: 0, att: 0, per: 0 };

  const response = await client.post(
    `${baseUrl}Academics/studentattendance.aspx/ShowAttendance`,
    JSON.stringify({ fromDate, toDate, excludeothersubjects: false }),
    {
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Referer: referer,
      },
    },
  );

  // The payload is HTML inside a JSON string. "Not an authorized user" is what
  // comes back when the session did not carry — not an empty timetable.
  const body = await response.json().catch(() => null);
  const html = body?.d;
  if (!html || html === "Not an authorized user") return { subjects, overall };

  const $ = cheerio.load(html);

  $("tr.reportData1").each((_, el) => {
    const cols = $(el).find("td");
    if (cols.length < 5) return;
    subjects.push({
      subject: $(cols[1]).text().trim(),
      held: parseInt($(cols[2]).text(), 10) || 0,
      attended: parseInt($(cols[3]).text(), 10) || 0,
      percentage: parseFloat($(cols[4]).text()) || 0,
    });
  });

  $("tr.reportHeading2WithBackground").each((_, el) => {
    if (!$(el).text().toUpperCase().includes("TOTAL")) return;
    const cols = $(el).find("td");
    if (cols.length < 4) return;
    overall = {
      held: parseInt($(cols[1]).text(), 10) || 0,
      att: parseInt($(cols[2]).text(), 10) || 0,
      per: parseFloat($(cols[3]).text()) || 0,
    };
  });

  return { subjects, overall };
}

/**
 * Semester grade tables, which AEC and ACET lay out horizontally: course names
 * across the header row, grades across a row whose first cell says "GRADE".
 */
export function parseMarksHtml(rawHtml) {
  const grades = [];
  let cgpa = "N/A";

  let html = typeof rawHtml === "string" ? rawHtml : "";
  // The handler returns a quoted, escaped JS string rather than clean HTML.
  if (html.startsWith("'") && html.endsWith("'")) html = html.slice(1, -1);
  html = html
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/&nbsp;/gi, " ")
    .replace(/ /g, " ")
    .replace(/[\r\n]+/g, " ");

  const cgpaMatch = html.match(/CGPA:\s*([\d.]+)/i);
  if (cgpaMatch) cgpa = cgpaMatch[1];

  // Narrow to the marks section so the previous-semesters attendance tables
  // below it are not mistaken for grade tables.
  const start = html.indexOf("EXTERNAL MARKS");
  const end = html.indexOf("PREVIOUS SEMESTERS ATTENDANCE");
  const section =
    start === -1 ? html : end === -1 ? html.slice(start) : html.slice(start, end);

  const $ = cheerio.load(section);

  $("table").each((i, table) => {
    const semester =
      $(table).prevAll("span.reportHeading2").first().text().trim() || `Semester ${i + 1}`;

    const courseNames = [];
    $(table)
      .find("tr.reportHeading2WithBackground td")
      .each((j, td) => {
        if (j > 0) courseNames.push($(td).text().trim());
      });

    const courseGrades = [];
    $(table)
      .find("tr")
      .each((_, tr) => {
        if (!$(tr).find("td").first().text().trim().toUpperCase().includes("GRADE")) return;
        $(tr)
          .find("td")
          .each((k, td) => {
            if (k > 0) courseGrades.push($(td).text().trim());
          });
      });

    if (courseNames.length === 0 || courseGrades.length === 0) return;

    let sgpa = "0.00";
    const subjects = [];

    courseNames.forEach((name, k) => {
      const grade = courseGrades[k] || "-";
      if (name.toUpperCase() === "SGPA") {
        if (grade !== "-" && !Number.isNaN(parseFloat(grade))) sgpa = parseFloat(grade).toFixed(2);
        return;
      }
      // Derived here rather than read: the portal prints a grade, not a verdict.
      const failed = grade === "F" || grade === "-" || grade.toUpperCase() === "AB";
      subjects.push({
        sNo: String(k + 1),
        courseName: name,
        grade,
        result: failed ? "F" : "P",
      });
    });

    if (subjects.length > 0) grades.push({ semester, sgpa, subjects });
  });

  return { grades, cgpa };
}

/**
 * Signs in as the student, reads what the portal shows them, and signs out.
 *
 * Returns the shape documented in SYSTEM_README §3. The password is a local
 * const for the length of this call and is never returned, logged or stored.
 */
export async function scrapeCampus({ campus, rollNumber, password }) {
  const config = CAMPUSES[campus];
  if (!config) throw new Error(`Unsupported campus: ${campus}`);

  const { baseUrl, btnX, btnY } = config;
  const client = newClient();

  // ASP.NET WebForms rejects a post that does not echo these back, and they are
  // per-session — fetched fresh every login, never cached.
  const loginPage = await client.get(`${baseUrl}default.aspx`);
  const $login = cheerio.load(await loginPage.text());
  const viewState = $login("#__VIEWSTATE").val() ?? "";
  const viewStateGenerator = $login("#__VIEWSTATEGENERATOR").val() ?? "";
  const eventValidation = $login("#__EVENTVALIDATION").val() ?? "";

  const encrypted = encryptPassword(password);

  const form = new URLSearchParams({
    __VIEWSTATE: viewState,
    __VIEWSTATEGENERATOR: viewStateGenerator,
    __VIEWSTATEENCRYPTED: "",
    __EVENTVALIDATION: eventValidation,
    txtId2: rollNumber,
    txtPwd2: encrypted,
    "imgBtn2.x": String(btnX),
    "imgBtn2.y": String(btnY),
    hdnpwd2: encrypted,
    hdnDPToken: $login("#hdnDPToken").val() ?? "",
  });

  // The redirect *is* the success signal here; a 200 means the login page
  // re-rendered with an error on it, which is why redirects are not followed.
  const posted = await client.post(`${baseUrl}default.aspx`, form, {
    follow: false,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: `${baseUrl}default.aspx`,
    },
  });

  if (posted.status === 200) {
    const message = cheerio.load(await posted.text())("#lblError").text().trim();
    throw new InvalidCredentialsError(
      message || "The portal rejected the sign-in without saying why.",
    );
  }
  if (posted.status !== 302) {
    throw new Error(`Portal returned ${posted.status} instead of a sign-in redirect.`);
  }

  const dashboard = await client.get(
    new URL(posted.headers.get("location"), baseUrl).href,
  );
  const studentName =
    cheerio.load(await dashboard.text())("#lblUser").text().trim().replace("Hi...", "").trim() ||
    null;

  // Attendance and marks are independent: a student with one and not the other
  // should still get the half that worked, so neither failure aborts the other.
  const attendance = {
    overall: { subjects: [], overall: { held: 0, att: 0, per: 0 } },
    today: { subjects: [], overall: { held: 0, att: 0, per: 0 } },
    yesterday: { subjects: [], overall: { held: 0, att: 0, per: 0 } },
  };

  try {
    const attendanceUrl = `${baseUrl}Academics/studentattendance.aspx`;
    // Visited first because the AJAX endpoint expects the page session.
    await client.get(attendanceUrl, { headers: { Referer: `${baseUrl}StudentMaster.aspx` } });

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    attendance.overall = await fetchAttendance(client, baseUrl, "", "", attendanceUrl);
    attendance.today = await fetchAttendance(
      client, baseUrl, portalDate(today), portalDate(today), attendanceUrl,
    );
    attendance.yesterday = await fetchAttendance(
      client, baseUrl, portalDate(yesterday), portalDate(yesterday), attendanceUrl,
    );
  } catch (error) {
    console.error(`[portal] ${campus} attendance failed:`, error.message);
  }

  let grades = [];
  let cgpa = "N/A";

  try {
    const marksUrl = `${baseUrl}Academics/StudentMarksReport.aspx`;
    const marksPage = await client.get(marksUrl, {
      headers: { Referer: `${baseUrl}StudentMaster.aspx` },
    });

    // The handler filename changes with every portal deploy, so it is read off
    // the page rather than hardcoded — a stale one 404s and marks vanish.
    const handler = (await marksPage.text()).match(
      /Academics_StudentMarksReport,App_Web_studentmarksreport\.aspx\.[a-z0-9]+\.ashx/i,
    );
    if (!handler) throw new Error("marks handler not found on the page");

    const marks = await client.post(
      `${baseUrl}ajax/${handler[0]}?_method=ShowMarks&_session=rw`,
      "",
      { headers: { "Content-Type": "text/plain;charset=UTF-8", Referer: marksUrl } },
    );

    ({ grades, cgpa } = parseMarksHtml(await marks.text()));
  } catch (error) {
    console.error(`[portal] ${campus} marks failed:`, error.message);
  }

  // Best effort: a session left open expires by itself, and failing to log out
  // is not worth failing the request the student actually asked for.
  try {
    await client.post(
      `${baseUrl}StudentMaster.aspx`,
      new URLSearchParams({
        __EVENTTARGET: "lnkLogOut",
        __EVENTARGUMENT: "",
        __VIEWSTATE: viewState,
        __VIEWSTATEGENERATOR: viewStateGenerator,
        __EVENTVALIDATION: eventValidation,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );
  } catch {
    /* ignore */
  }

  return {
    name: studentName,
    cgpa,
    academicStats: { passed: 0, failed: 0, total: 0 },
    grades,
    attendance,
    overall: attendance.overall.overall,
    subjects: attendance.overall.subjects,
    schedule: [],
    exams: [],
    features: ["attendance", "exams"],
  };
}
