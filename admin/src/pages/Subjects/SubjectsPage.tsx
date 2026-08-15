import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDocs, orderBy, query, where } from "firebase/firestore";
import { subjectsCol, semestersCol, facultyCol } from "@/services/firebase/collections";
import { callAdminApi } from "@/services/adminApi";
import { ROUTES } from "@/constants/routes";

async function loadSubjects(semesterId: string) {
  if (!semesterId.trim()) return [];
  const snap = await getDocs(
    query(subjectsCol(), where("semesterId", "==", semesterId.trim()), orderBy("code")),
  );
  return snap.docs.map((d) => d.data());
}

async function loadSemesters() {
  const snap = await getDocs(query(semestersCol(), where("active", "==", true), orderBy("startDate", "desc")));
  return snap.docs.map((d) => d.data());
}

async function loadFaculty() {
  const snap = await getDocs(query(facultyCol(), where("active", "==", true), orderBy("name")));
  return snap.docs.map((d) => d.data());
}

export function SubjectsPage() {
  // Browsing stays free text — it has to work for subjects created before
  // Academic setup's semester records existed (scripts/seed-students.mjs
  // among others), so a strict dropdown here would make older subjects
  // unreachable. Only the create form below is tied to a real semester.
  const [semesterId, setSemesterId] = useState("");
  const qc = useQueryClient();
  const { data: subjects, isLoading, error } = useQuery({
    queryKey: ["subjects", semesterId],
    queryFn: () => loadSubjects(semesterId),
  });
  const { data: semesters } = useQuery({ queryKey: ["semesters"], queryFn: loadSemesters });
  const { data: faculty } = useQuery({ queryKey: ["faculty"], queryFn: loadFaculty });

  const [form, setForm] = useState({ code: "", name: "", facultyId: "", department: "", semesterId: "" });
  const [createError, setCreateError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => {
      const chosenFaculty = faculty?.find((f) => f.id === form.facultyId);
      return callAdminApi("subjects", {
        action: "create",
        data: {
          code: form.code,
          name: form.name,
          department: form.department,
          semesterId: form.semesterId,
          facultyId: form.facultyId || "",
          facultyName: chosenFaculty?.name ?? "",
        },
      });
    },
    onSuccess: () => {
      setForm({ code: "", name: "", facultyId: "", department: "", semesterId: form.semesterId });
      void qc.invalidateQueries({ queryKey: ["subjects", semesterId] });
    },
    onError: (e: Error) => {
      setCreateError(
        e.message === "self_namespace_reserved"
          ? "That semester is reserved for students' own synced data."
          : "Couldn't create the subject.",
      );
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => callAdminApi("subjects", { action: "delete", id }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["subjects", semesterId] }),
  });

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="pageTitle">Subjects</h1>
          <p className="pageSub">
            Real, college-wide subjects only. Every synced student has their own private copy that lives
            elsewhere — see the note on the Timetables page.
          </p>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Semester id to browse, e.g. 2026-sem1"
          value={semesterId}
          onChange={(e) => setSemesterId(e.target.value)}
          style={{ minWidth: 260 }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start" }}>
        <div className="card">
          {!semesterId.trim() ? (
            <p className="emptyState">Enter a semester id to browse its subjects.</p>
          ) : error ? (
            <p className="errorBanner">Couldn't load subjects.</p>
          ) : isLoading ? (
            <p className="emptyState">Loading…</p>
          ) : !subjects?.length ? (
            <p className="emptyState">No subjects in this semester yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Faculty</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.id}>
                    <td>{s.code}</td>
                    <td>{s.name}</td>
                    <td>{s.facultyName || "—"}</td>
                    <td>
                      <span className={`pill ${s.active ? "pillSuccess" : "pillNeutral"}`}>
                        {s.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      {s.active && (
                        <button type="button" className="btn" onClick={() => deactivate.mutate(s.id)}>
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card cardPad">
          <h2 style={{ fontSize: 14, fontWeight: 650, marginBottom: 16 }}>Add subject</h2>
          {createError && <p className="errorBanner">{createError}</p>}
          {!semesters?.length ? (
            <p className="emptyState">
              No semesters set up yet. Add one on <Link to={ROUTES.academic}>Academic setup</Link> first.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <label className="field">
                <span className="label">Semester</span>
                <select
                  className="select"
                  value={form.semesterId}
                  onChange={(e) => setForm({ ...form, semesterId: e.target.value })}
                >
                  <option value="">Pick a semester…</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Code</span>
                <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              </label>
              <label className="field">
                <span className="label">Name</span>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="field">
                <span className="label">Faculty</span>
                <select
                  className="select"
                  value={form.facultyId}
                  onChange={(e) => setForm({ ...form, facultyId: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {faculty?.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} · {f.department}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Department</span>
                <input
                  className="input"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="btn btnPrimary"
                disabled={!form.code || !form.name || !form.semesterId || create.isPending}
                onClick={() => {
                  setCreateError(null);
                  create.mutate();
                }}
              >
                {create.isPending ? "Adding…" : "Add subject"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
