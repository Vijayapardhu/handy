import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDoc, getDocs, orderBy, query, where } from "firebase/firestore";
import { collegeDocRef, semestersCol, facultyCol } from "@/services/firebase/collections";
import { callAdminApi } from "@/services/adminApi";
import type { CollegeConfigDoc } from "@/types/college";

/**
 * Three small, related management surfaces in one page rather than three nav
 * items: colleges, semesters, and faculty are all foundational data that
 * changes rarely (once a term, maybe), unlike students or announcements
 * which an admin touches constantly. Semesters and faculty replace what used
 * to be free-text typed into the Subjects/Timetables forms each time — see
 * those pages, which now pull from what's created here instead.
 */
export function AcademicPage() {
  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="pageTitle">Academic setup</h1>
          <p className="pageSub">Colleges, semesters and faculty — the data everything else references.</p>
        </div>
      </div>

      <div style={{ display: "grid", gap: 24 }}>
        <CollegeSection />
        <SemestersSection />
        <FacultySection />
      </div>
    </div>
  );
}

function CollegeSection() {
  const [collegeId, setCollegeId] = useState("");
  const [committed, setCommitted] = useState("");
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["college", committed],
    queryFn: async () => {
      const snap = await getDoc(collegeDocRef(committed));
      return snap.exists() ? snap.data() : null;
    },
    enabled: !!committed,
  });

  const [form, setForm] = useState<Partial<CollegeConfigDoc> | null>(null);
  const effective = form ?? data ?? null;

  const save = useMutation({
    mutationFn: () =>
      callAdminApi("academic", {
        entity: "college",
        action: "update",
        id: committed,
        data: {
          minimumAttendancePercentage: Number(effective?.minimumAttendancePercentage ?? 75),
          condonationPercentage: effective?.condonationPercentage ?? null,
          workingDaysPerWeek: Number(effective?.workingDaysPerWeek ?? 6),
          classDurationMinutes: Number(effective?.classDurationMinutes ?? 50),
        },
      }),
    onSuccess: () => {
      setForm(null);
      void qc.invalidateQueries({ queryKey: ["college", committed] });
    },
  });

  return (
    <section className="card cardPad">
      <h2 style={{ fontSize: 14, fontWeight: 650, marginBottom: 12 }}>College config</h2>
      <div className="toolbar">
        <input
          className="input"
          placeholder="College id, e.g. self-import"
          value={collegeId}
          onChange={(e) => setCollegeId(e.target.value)}
          style={{ minWidth: 220 }}
        />
        <button type="button" className="btn" onClick={() => setCommitted(collegeId.trim())}>
          Load
        </button>
      </div>

      {committed && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxWidth: 560 }}>
          <label className="field">
            <span className="label">Minimum attendance %</span>
            <input
              className="input"
              type="number"
              value={effective?.minimumAttendancePercentage ?? 75}
              onChange={(e) => setForm({ ...effective, minimumAttendancePercentage: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span className="label">Working days / week</span>
            <input
              className="input"
              type="number"
              value={effective?.workingDaysPerWeek ?? 6}
              onChange={(e) => setForm({ ...effective, workingDaysPerWeek: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span className="label">Class duration (min)</span>
            <input
              className="input"
              type="number"
              value={effective?.classDurationMinutes ?? 50}
              onChange={(e) => setForm({ ...effective, classDurationMinutes: Number(e.target.value) })}
            />
          </label>
          <button
            type="button"
            className="btn btnPrimary"
            style={{ gridColumn: "1 / -1", justifySelf: "start" }}
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </section>
  );
}

function SemestersSection() {
  const qc = useQueryClient();
  const { data: semesters } = useQuery({
    queryKey: ["semesters"],
    queryFn: async () => {
      const snap = await getDocs(query(semestersCol(), where("active", "==", true), orderBy("startDate", "desc")));
      return snap.docs.map((d) => d.data());
    },
  });

  const [label, setLabel] = useState("");
  const [startDate, setStartDate] = useState("");

  const create = useMutation({
    mutationFn: () => callAdminApi("academic", { entity: "semester", action: "create", data: { label, startDate } }),
    onSuccess: () => {
      setLabel("");
      setStartDate("");
      void qc.invalidateQueries({ queryKey: ["semesters"] });
    },
  });

  const archive = useMutation({
    mutationFn: (id: string) => callAdminApi("academic", { entity: "semester", action: "archive", id }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["semesters"] }),
  });

  return (
    <section className="card cardPad">
      <h2 style={{ fontSize: 14, fontWeight: 650, marginBottom: 12 }}>Semesters</h2>
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 12 }}>
        What the Subjects and Timetables pages offer when creating something new, in place of a free-typed id.
      </p>
      <div className="toolbar">
        <input className="input" placeholder="Label, e.g. 2026 Semester 1" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <button type="button" className="btn btnPrimary" disabled={!label || !startDate || create.isPending} onClick={() => create.mutate()}>
          Add
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {semesters?.map((s) => (
          <span key={s.id} className="pill pillNeutral" style={{ gap: 8 }}>
            {s.label}
            <button
              type="button"
              onClick={() => archive.mutate(s.id)}
              style={{ background: "none", border: 0, cursor: "pointer", color: "inherit" }}
              aria-label={`Archive ${s.label}`}
            >
              ×
            </button>
          </span>
        ))}
        {!semesters?.length && <span className="emptyState">No semesters yet.</span>}
      </div>
    </section>
  );
}

function FacultySection() {
  const qc = useQueryClient();
  const { data: faculty } = useQuery({
    queryKey: ["faculty"],
    queryFn: async () => {
      const snap = await getDocs(query(facultyCol(), where("active", "==", true), orderBy("name")));
      return snap.docs.map((d) => d.data());
    },
  });

  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");

  const create = useMutation({
    mutationFn: () => callAdminApi("academic", { entity: "faculty", action: "create", data: { name, department } }),
    onSuccess: () => {
      setName("");
      setDepartment("");
      void qc.invalidateQueries({ queryKey: ["faculty"] });
    },
  });

  const archive = useMutation({
    mutationFn: (id: string) => callAdminApi("academic", { entity: "faculty", action: "archive", id }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["faculty"] }),
  });

  return (
    <section className="card cardPad">
      <h2 style={{ fontSize: 14, fontWeight: 650, marginBottom: 12 }}>Faculty</h2>
      <div className="toolbar">
        <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Department" value={department} onChange={(e) => setDepartment(e.target.value)} />
        <button
          type="button"
          className="btn btnPrimary"
          disabled={!name || !department || create.isPending}
          onClick={() => create.mutate()}
        >
          Add
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {faculty?.map((f) => (
          <span key={f.id} className="pill pillNeutral" style={{ gap: 8 }}>
            {f.name} · {f.department}
            <button
              type="button"
              onClick={() => archive.mutate(f.id)}
              style={{ background: "none", border: 0, cursor: "pointer", color: "inherit" }}
              aria-label={`Archive ${f.name}`}
            >
              ×
            </button>
          </span>
        ))}
        {!faculty?.length && <span className="emptyState">No faculty yet.</span>}
      </div>
    </section>
  );
}
