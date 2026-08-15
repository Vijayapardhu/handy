import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { endAt, getDocs, limit, orderBy, query, startAt, where } from "firebase/firestore";
import { studentsCol } from "@/services/firebase/collections";
import { callAdminApi } from "@/services/adminApi";
import { toCsv, downloadCsv, parseCsvWithHeader } from "@/lib/csv";
import { ROUTES } from "@/constants/routes";
import type { StudentDoc } from "@/types/student";

const PAGE_SIZE = 50;

async function searchStudents(search: string, section: string): Promise<StudentDoc[]> {
  const trimmed = search.trim();
  let q = query(studentsCol(), orderBy("rollNumber"), limit(PAGE_SIZE));

  if (trimmed) {
    // Prefix match on rollNumber: Firestore string range queries are exact
    // for this — [prefix, prefix + ) covers every string that starts
    // with it, since  sorts after any realistic input character.
    const upper = trimmed.toUpperCase();
    q = query(studentsCol(), orderBy("rollNumber"), startAt(upper), endAt(upper + ""), limit(PAGE_SIZE));
  } else if (section.trim()) {
    q = query(studentsCol(), where("section", "==", section.trim()), orderBy("rollNumber"), limit(PAGE_SIZE));
  }

  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

const EXPORT_COLUMNS = ["rollNumber", "name", "department", "course", "year", "section", "semesterId", "profileComplete"] as const;
const IMPORT_COLUMNS = ["rollNumber", "name", "department", "course", "year", "section", "semesterId", "collegeId"] as const;

export function StudentsPage() {
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("");
  const { data: students, isLoading, error } = useQuery({
    queryKey: ["students", search, section],
    queryFn: () => searchStudents(search, section),
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  function toggle(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(uid)) next.add(uid);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === students?.length ? new Set() : new Set(students?.map((s) => s.uid))));
  }

  function exportCsv(rows: StudentDoc[], filename: string) {
    const csv = toCsv(
      [...EXPORT_COLUMNS],
      rows.map((s) => EXPORT_COLUMNS.map((c) => String(s[c] ?? ""))),
    );
    downloadCsv(filename, csv);
  }

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="pageTitle">Students</h1>
          <p className="pageSub">Search by roll number, or filter by section.</p>
        </div>
        {!!students?.length && (
          <button type="button" className="btn" onClick={() => exportCsv(students, "students.csv")}>
            Export results as CSV
          </button>
        )}
      </div>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Roll number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 220 }}
        />
        <input
          className="input"
          placeholder="Section (e.g. CSE-A)"
          value={section}
          onChange={(e) => setSection(e.target.value)}
          disabled={!!search.trim()}
          style={{ minWidth: 180 }}
        />
      </div>

      {error && <p className="errorBanner">Couldn't load students.</p>}

      {selected.size > 0 && (
        <BulkActionBar
          selected={selected}
          students={students ?? []}
          onClear={() => setSelected(new Set())}
          onExport={(rows) => exportCsv(rows, "selected-students.csv")}
        />
      )}

      <div className="card">
        {isLoading ? (
          <p className="emptyState">Loading…</p>
        ) : !students?.length ? (
          <p className="emptyState">
            {search || section ? "No students match." : "Type a roll number or pick a section to browse."}
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === students.length}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <th>Roll number</th>
                <th>Name</th>
                <th>Department</th>
                <th>Section</th>
                <th>Year</th>
                <th>Profile</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(s.uid)}
                      onChange={() => toggle(s.uid)}
                      aria-label={`Select ${s.rollNumber}`}
                    />
                  </td>
                  <td>
                    <Link to={ROUTES.studentDetail(s.id)}>{s.rollNumber}</Link>
                  </td>
                  <td>{s.name || "—"}</td>
                  <td>{s.department || "—"}</td>
                  <td>{s.section || "—"}</td>
                  <td>{s.year ?? "—"}</td>
                  <td>
                    <span className={`pill ${s.profileComplete ? "pillSuccess" : "pillWarning"}`}>
                      {s.profileComplete ? "Complete" : "Pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ImportSection />
    </div>
  );
}

function BulkActionBar({
  selected,
  students,
  onClear,
  onExport,
}: {
  selected: Set<string>;
  students: StudentDoc[];
  onClear: () => void;
  onExport: (rows: StudentDoc[]) => void;
}) {
  const qc = useQueryClient();
  const [moveTo, setMoveTo] = useState({ section: "", semesterId: "" });
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const uids = [...selected];
  const selectedRows = students.filter((s) => selected.has(s.uid));

  const move = useMutation({
    mutationFn: () => {
      const updates: Record<string, string> = {};
      if (moveTo.section.trim()) updates.section = moveTo.section.trim();
      if (moveTo.semesterId.trim()) updates.semesterId = moveTo.semesterId.trim();
      return callAdminApi<{ updated: number }>("students", { uids, updates });
    },
    onSuccess: (res) => {
      setResult(`Moved ${res.updated} student(s).`);
      setMoveTo({ section: "", semesterId: "" });
      void qc.invalidateQueries({ queryKey: ["students"] });
    },
  });

  const notify = useMutation({
    mutationFn: () =>
      callAdminApi<{ recipients: number; delivered: number }>("notify", {
        target: { type: "students", uids },
        title: notifyTitle,
        body: notifyBody,
      }),
    onSuccess: (res) => {
      setResult(`Notified ${res.recipients} student(s), ${res.delivered} delivered.`);
      setNotifyTitle("");
      setNotifyBody("");
      setNotifyOpen(false);
    },
  });

  return (
    <div className="card cardPad" style={{ marginBottom: 16, background: "var(--color-primary-light)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 13.5 }}>{selected.size} selected</strong>
        <input
          className="input"
          placeholder="New section"
          value={moveTo.section}
          onChange={(e) => setMoveTo({ ...moveTo, section: e.target.value })}
          style={{ width: 140 }}
        />
        <input
          className="input"
          placeholder="New semester id"
          value={moveTo.semesterId}
          onChange={(e) => setMoveTo({ ...moveTo, semesterId: e.target.value })}
          style={{ width: 160 }}
        />
        <button
          type="button"
          className="btn"
          disabled={(!moveTo.section.trim() && !moveTo.semesterId.trim()) || move.isPending}
          onClick={() => move.mutate()}
        >
          Move
        </button>
        <button type="button" className="btn" onClick={() => setNotifyOpen((v) => !v)}>
          Notify selected
        </button>
        <button type="button" className="btn" onClick={() => onExport(selectedRows)}>
          Export selected
        </button>
        <button type="button" className="btn" onClick={onClear} style={{ marginLeft: "auto" }}>
          Clear selection
        </button>
      </div>

      {notifyOpen && (
        <div style={{ display: "grid", gap: 8, marginTop: 12, maxWidth: 420 }}>
          <input className="input" placeholder="Title" value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} />
          <textarea className="textarea" placeholder="Message" value={notifyBody} onChange={(e) => setNotifyBody(e.target.value)} />
          <button
            type="button"
            className="btn btnPrimary"
            disabled={!notifyTitle || notify.isPending}
            onClick={() => notify.mutate()}
          >
            {notify.isPending ? "Sending…" : `Send to ${selected.size}`}
          </button>
        </div>
      )}

      {result && <p style={{ fontSize: 13, marginTop: 10 }}>{result}</p>}
    </div>
  );
}

function ImportSection() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [summary, setSummary] = useState<string | null>(null);

  const preview = csvText.trim() ? parseCsvWithHeader(csvText) : [];

  const importMutation = useMutation({
    mutationFn: () => {
      const rows = parseCsvWithHeader(csvText).map((row) => ({
        rollNumber: row.rollNumber,
        name: row.name,
        department: row.department,
        course: row.course,
        year: row.year,
        section: row.section,
        semesterId: row.semesterId,
        collegeId: row.collegeId,
      }));
      return callAdminApi<{ created: number; skipped: number; failed: number }>("import-students", { rows });
    },
    onSuccess: (res) => {
      setSummary(`Created ${res.created}, skipped ${res.skipped} (already existed), failed ${res.failed}.`);
      setCsvText("");
      void qc.invalidateQueries({ queryKey: ["students"] });
    },
  });

  return (
    <div className="card cardPad" style={{ marginTop: 24 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ background: "none", border: 0, cursor: "pointer", padding: 0, fontSize: 14, fontWeight: 650 }}
      >
        {open ? "▾" : "▸"} Bulk import students
      </button>

      {open && (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            Creates new accounts only — a roll number that already has one is skipped, never overwritten. Header
            row required: <code>{IMPORT_COLUMNS.join(",")}</code>. New accounts sign in with the same shared
            default password every other onboarding path in this app uses.
          </p>
          <textarea
            className="textarea"
            style={{ minHeight: 140, fontFamily: "monospace", fontSize: 12.5 }}
            placeholder={`${IMPORT_COLUMNS.join(",")}\n23A31A05B1,Jane Doe,CSE,B.Tech,2,CSE-A,2026-sem1,college-1`}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          {summary && <p className="successBanner">{summary}</p>}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              className="btn btnPrimary"
              disabled={preview.length === 0 || importMutation.isPending}
              onClick={() => {
                setSummary(null);
                importMutation.mutate();
              }}
            >
              {importMutation.isPending ? "Importing…" : `Import ${preview.length} row(s)`}
            </button>
            {preview.length > 0 && (
              <span style={{ fontSize: 12.5, color: "var(--color-text-faint)" }}>
                First row: {preview[0]?.rollNumber || "(no rollNumber column found)"}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
