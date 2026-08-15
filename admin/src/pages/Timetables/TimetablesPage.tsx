import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDocs, orderBy, query, where } from "firebase/firestore";
import {
  timetableVersionsCol,
  timetableEntriesCol,
  subjectsCol,
  semestersCol,
  facultyCol,
} from "@/services/firebase/collections";
import { callAdminApi } from "@/services/adminApi";
import { ROUTES } from "@/constants/routes";
import type { TimetableEntryType } from "@/types/timetable";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function loadVersions(semesterId: string) {
  if (!semesterId.trim()) return [];
  const snap = await getDocs(query(timetableVersionsCol(), where("semesterId", "==", semesterId.trim())));
  return snap.docs.map((d) => d.data()).sort((a, b) => b.versionNumber - a.versionNumber);
}

async function loadEntries(versionId: string) {
  if (!versionId) return [];
  const snap = await getDocs(
    query(timetableEntriesCol(), where("timetableVersionId", "==", versionId), orderBy("dayOfWeek")),
  );
  return snap.docs.map((d) => d.data()).filter((e) => e.active !== false);
}

async function loadSubjectNames(semesterId: string) {
  if (!semesterId.trim()) return new Map<string, string>();
  const snap = await getDocs(query(subjectsCol(), where("semesterId", "==", semesterId.trim())));
  return new Map(snap.docs.map((d) => [d.id, d.data().name]));
}

async function loadSemesters() {
  const snap = await getDocs(query(semestersCol(), where("active", "==", true), orderBy("startDate", "desc")));
  return snap.docs.map((d) => d.data());
}

async function loadFaculty() {
  const snap = await getDocs(query(facultyCol(), where("active", "==", true), orderBy("name")));
  return snap.docs.map((d) => d.data());
}

export function TimetablesPage() {
  // Browsing stays free text, same reasoning as the Subjects page — has to
  // work for versions that predate Academic setup's semester records.
  const [semesterId, setSemesterId] = useState("");
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: versions } = useQuery({ queryKey: ["tt-versions", semesterId], queryFn: () => loadVersions(semesterId) });
  const { data: entries } = useQuery({
    queryKey: ["tt-entries", selectedVersion],
    queryFn: () => loadEntries(selectedVersion!),
    enabled: !!selectedVersion,
  });
  const { data: subjectNames } = useQuery({ queryKey: ["subjects-map", semesterId], queryFn: () => loadSubjectNames(semesterId) });
  const { data: semesters } = useQuery({ queryKey: ["semesters"], queryFn: loadSemesters });
  const { data: faculty } = useQuery({ queryKey: ["faculty"], queryFn: loadFaculty });

  const [newVersion, setNewVersion] = useState({ semesterId: "", department: "", section: "", versionNumber: 1 });
  const createVersion = useMutation({
    mutationFn: () => callAdminApi<{ id: string }>("timetables", { entity: "version", action: "create", data: newVersion }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["tt-versions", semesterId] });
      setSelectedVersion(res.id);
    },
  });

  const publish = useMutation({
    mutationFn: (id: string) => callAdminApi("timetables", { entity: "version", action: "publish", id }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tt-versions", semesterId] }),
  });

  const [entryForm, setEntryForm] = useState({
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "10:00",
    subjectId: "",
    facultyId: "",
    room: "",
    type: "lecture" as TimetableEntryType,
  });
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);

  const addEntry = useMutation({
    mutationFn: (force: boolean) => {
      const chosenFaculty = faculty?.find((f) => f.id === entryForm.facultyId);
      return callAdminApi<{ warning?: string; overlaps?: { subjectId: string; startTime: string; endTime: string }[] }>(
        "timetables",
        {
          entity: "entry",
          action: "create",
          data: {
            ...entryForm,
            facultyName: chosenFaculty?.name ?? "",
            timetableVersionId: selectedVersion,
          },
          force,
        },
      );
    },
    onSuccess: (res) => {
      if (res.warning === "overlap") {
        setOverlapWarning(
          `Overlaps with ${res.overlaps?.length} existing class(es) that day. Add anyway?`,
        );
        return;
      }
      setOverlapWarning(null);
      void qc.invalidateQueries({ queryKey: ["tt-entries", selectedVersion] });
    },
  });

  const removeEntry = useMutation({
    mutationFn: (id: string) => callAdminApi("timetables", { entity: "entry", action: "delete", id }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tt-entries", selectedVersion] }),
  });

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="pageTitle">Timetables</h1>
          <p className="pageSub">
            Real timetable versions only. A student who has ever synced from the portal keeps using their own
            private copy regardless of what's published here — see the plan note; assignment isn't built yet.
          </p>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Semester id to browse, e.g. 2026-sem1"
          value={semesterId}
          onChange={(e) => {
            setSemesterId(e.target.value);
            setSelectedVersion(null);
          }}
          style={{ minWidth: 260 }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24, alignItems: "start" }}>
        <div className="card cardPad">
          <h2 style={{ fontSize: 14, fontWeight: 650, marginBottom: 12 }}>Versions</h2>
          <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
            {!semesterId.trim() ? (
              <p className="emptyState">Enter a semester id above to browse.</p>
            ) : !versions?.length ? (
              <p className="emptyState">No versions yet.</p>
            ) : (
              versions.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className="btn"
                  style={{
                    justifyContent: "space-between",
                    background: v.id === selectedVersion ? "var(--color-primary-light)" : undefined,
                  }}
                  onClick={() => setSelectedVersion(v.id)}
                >
                  <span>
                    {v.department} {v.section} · v{v.versionNumber}
                  </span>
                  <span className={`pill ${v.status === "published" ? "pillSuccess" : "pillNeutral"}`}>
                    {v.status}
                  </span>
                </button>
              ))
            )}
          </div>

          <h3 style={{ fontSize: 12.5, fontWeight: 650, color: "var(--color-text-muted)", marginBottom: 8 }}>
            New version
          </h3>
          {!semesters?.length ? (
            <p className="emptyState">
              No semesters yet. Add one on <Link to={ROUTES.academic}>Academic setup</Link> first.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <select
                className="select"
                value={newVersion.semesterId}
                onChange={(e) => setNewVersion({ ...newVersion, semesterId: e.target.value })}
              >
                <option value="">Semester…</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <input
                className="input"
                placeholder="Department"
                value={newVersion.department}
                onChange={(e) => setNewVersion({ ...newVersion, department: e.target.value })}
              />
              <input
                className="input"
                placeholder="Section"
                value={newVersion.section}
                onChange={(e) => setNewVersion({ ...newVersion, section: e.target.value })}
              />
              <input
                className="input"
                type="number"
                placeholder="Version #"
                value={newVersion.versionNumber}
                onChange={(e) => setNewVersion({ ...newVersion, versionNumber: Number(e.target.value) || 1 })}
              />
              <button
                type="button"
                className="btn btnPrimary"
                disabled={!newVersion.semesterId || !newVersion.department || !newVersion.section || createVersion.isPending}
                onClick={() => createVersion.mutate()}
              >
                Create draft
              </button>
            </div>
          )}
        </div>

        <div>
          {!selectedVersion ? (
            <p className="emptyState">Pick a version to see its entries.</p>
          ) : (
            <>
              {versions?.find((v) => v.id === selectedVersion)?.status === "draft" && (
                <button
                  type="button"
                  className="btn btnPrimary"
                  style={{ marginBottom: 12 }}
                  onClick={() => publish.mutate(selectedVersion)}
                >
                  Publish this version
                </button>
              )}

              <div className="card" style={{ marginBottom: 16 }}>
                {!entries?.length ? (
                  <p className="emptyState">No entries yet.</p>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Time</th>
                        <th>Subject</th>
                        <th>Faculty</th>
                        <th>Room</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e) => (
                        <tr key={e.id}>
                          <td>{DAYS[e.dayOfWeek]}</td>
                          <td>
                            {e.startTime}–{e.endTime}
                          </td>
                          <td>{subjectNames?.get(e.subjectId) ?? e.subjectId}</td>
                          <td>{e.facultyName || "—"}</td>
                          <td>{e.room || "—"}</td>
                          <td>
                            <button type="button" className="btn" onClick={() => removeEntry.mutate(e.id)}>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="card cardPad">
                <h3 style={{ fontSize: 13, fontWeight: 650, marginBottom: 12 }}>Add entry</h3>
                {overlapWarning && (
                  <div className="errorBanner">
                    {overlapWarning}{" "}
                    <button type="button" className="btn" onClick={() => addEntry.mutate(true)}>
                      Add anyway
                    </button>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  <select
                    className="select"
                    value={entryForm.dayOfWeek}
                    onChange={(e) => setEntryForm({ ...entryForm, dayOfWeek: Number(e.target.value) })}
                  >
                    {DAYS.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    type="time"
                    value={entryForm.startTime}
                    onChange={(e) => setEntryForm({ ...entryForm, startTime: e.target.value })}
                  />
                  <input
                    className="input"
                    type="time"
                    value={entryForm.endTime}
                    onChange={(e) => setEntryForm({ ...entryForm, endTime: e.target.value })}
                  />
                  <select
                    className="select"
                    value={entryForm.subjectId}
                    onChange={(e) => setEntryForm({ ...entryForm, subjectId: e.target.value })}
                  >
                    <option value="">Subject…</option>
                    {[...(subjectNames?.entries() ?? [])].map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="select"
                    value={entryForm.facultyId}
                    onChange={(e) => setEntryForm({ ...entryForm, facultyId: e.target.value })}
                  >
                    <option value="">Faculty…</option>
                    {faculty?.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    placeholder="Room"
                    value={entryForm.room}
                    onChange={(e) => setEntryForm({ ...entryForm, room: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn btnPrimary"
                    disabled={!entryForm.subjectId || addEntry.isPending}
                    onClick={() => {
                      setOverlapWarning(null);
                      addEntry.mutate(false);
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
