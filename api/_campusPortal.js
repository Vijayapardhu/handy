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
import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
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

function newClient() {
  return wrapper(
    axios.create({
      withCredentials: true,
      // A short ceiling on every call: a serverless function that hangs on a
      // slow portal burns its whole execution budget and returns nothing.
      timeout: 20000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
        Origin: "https://info.aec.edu.in",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    }),
  );
}

/**
 * One ShowAttendance call. Empty dates mean "everything so far"; both dates set
 * to the same day means that day only — the filtering happens on the portal.
 */
async function fetchAttendance(client, jar, baseUrl, fromDate, toDate, referer) {
  const subjects = [];
  let overall = { held: 0, att: 0, per: 0 };

  const response = await client.post(
    `${baseUrl}Academics/studentattendance.aspx/ShowAttendance`,
    { fromDate, toDate, excludeothersubjects: false },
    {
      jar,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Referer: referer,
      },
    },
  );

  // The payload is HTML inside a JSON string. "Not an authorized user" is what
  // comes back when the session did not carry — not an empty timetable.
  const html = response.data?.d;
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
  const jar = new CookieJar();

  // ASP.NET WebForms rejects a post that does not echo these back, and they are
  // per-session — fetched fresh every login, never cached.
  const loginPage = await client.get(`${baseUrl}default.aspx`, { jar });
  const $login = cheerio.load(loginPage.data);
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

  // maxRedirects: 0 so the 302 is ours to inspect. A redirect *is* the success
  // signal here; a 200 means the login page re-rendered with an error on it.
  const posted = await client.post(`${baseUrl}default.aspx`, form, {
    jar,
    maxRedirects: 0,
    validateStatus: () => true,
  });

  if (posted.status === 200) {
    const message = cheerio.load(posted.data)("#lblError").text().trim();
    throw new InvalidCredentialsError(
      message || "The portal rejected the sign-in without saying why.",
    );
  }
  if (posted.status !== 302) {
    throw new Error(`Portal returned ${posted.status} instead of a sign-in redirect.`);
  }

  const dashboard = await client.get(new URL(posted.headers.location, baseUrl).href, { jar });
  const studentName =
    cheerio.load(dashboard.data)("#lblUser").text().trim().replace("Hi...", "").trim() || null;

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
    await client.get(attendanceUrl, { jar, headers: { Referer: `${baseUrl}StudentMaster.aspx` } });

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    attendance.overall = await fetchAttendance(client, jar, baseUrl, "", "", attendanceUrl);
    attendance.today = await fetchAttendance(
      client, jar, baseUrl, portalDate(today), portalDate(today), attendanceUrl,
    );
    attendance.yesterday = await fetchAttendance(
      client, jar, baseUrl, portalDate(yesterday), portalDate(yesterday), attendanceUrl,
    );
  } catch (error) {
    console.error(`[portal] ${campus} attendance failed:`, error.message);
  }

  let grades = [];
  let cgpa = "N/A";

  try {
    const marksUrl = `${baseUrl}Academics/StudentMarksReport.aspx`;
    const marksPage = await client.get(marksUrl, {
      jar,
      headers: { Referer: `${baseUrl}StudentMaster.aspx` },
    });

    // The handler filename changes with every portal deploy, so it is read off
    // the page rather than hardcoded — a stale one 404s and marks vanish.
    const handler = String(marksPage.data).match(
      /Academics_StudentMarksReport,App_Web_studentmarksreport\.aspx\.[a-z0-9]+\.ashx/i,
    );
    if (!handler) throw new Error("marks handler not found on the page");

    const marks = await client.post(
      `${baseUrl}ajax/${handler[0]}?_method=ShowMarks&_session=rw`,
      "",
      { jar, headers: { "Content-Type": "text/plain;charset=UTF-8", Referer: marksUrl } },
    );

    ({ grades, cgpa } = parseMarksHtml(marks.data));
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
      { jar },
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
