import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDoc, getDocs, query, where } from "firebase/firestore";
import {
  studentDocRef,
  attendanceSummariesCol,
  subjectsCol,
  classGroupMembersCol,
  classRepsCol,
} from "@/services/firebase/collections";
import { STUDENT_EDITABLE_FIELDS, type StudentDoc } from "@/types/student";
import { callAdminApi } from "@/services/adminApi";

async function loadStudentDetail(uid: string) {
  const studentSnap = await getDoc(studentDocRef(uid));
  const student = studentSnap.exists() ? studentSnap.data() : null;
  if (!student) return null;

  const [summaries, subjects, memberships] = await Promise.all([
    getDocs(query(attendanceSummariesCol(), where("studentId", "==", uid))),
    getDocs(query(subjectsCol(), where("semesterId", "==", student.semesterId))),
    getDocs(query(classGroupMembersCol(), where("uid", "==", uid))),
  ]);

  const subjectById = new Map(subjects.docs.map((d) => [d.id, d.data()]));
  const groupKeys = memberships.docs.map((d) => d.data().groupKey);
  const reps = groupKeys.length
    ? await getDocs(query(classRepsCol(), where("uid", "==", uid)))
    : { docs: [] as { data: () => { groupKey: string; active: boolean } }[] };
  const repByGroup = new Map(reps.docs.map((d) => [d.data().groupKey, d.data().active]));

  return {
    student,
    summaries: summaries.docs.map((d) => {
      const s = d.data();
      const subj = subjectById.get(s.subjectId);
      return { ...s, subjectName: subj?.name ?? s.subjectId, subjectCode: subj?.code ?? "" };
    }),
    groups: memberships.docs.map((d) => {
      const m = d.data();
      return { groupKey: m.groupKey, isRep: repByGroup.get(m.groupKey) === true };
    }),
  };
}

export function StudentDetailPage() {
  const { studentId = "" } = useParams();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["student", studentId],
    queryFn: () => loadStudentDetail(studentId),
  });

  const [form, setForm] = useState<Partial<StudentDoc> | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState<string | null>(null);

  const editable = form ?? data?.student ?? null;

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const updates: Record<string, unknown> = {};
      for (const key of STUDENT_EDITABLE_FIELDS) {
        if (form[key] !== undefined && form[key] !== data?.student[key]) updates[key] = form[key];
      }
      if (Object.keys(updates).length === 0) return;
      await callAdminApi("students", { uid: studentId, updates });
    },
    onSuccess: () => {
      setSavedMsg("Saved.");
      setForm(null);
      void qc.invalidateQueries({ queryKey: ["student", studentId] });
    },
  });

  const reset = useMutation({
    mutationFn: () => callAdminApi<{ password: string }>("reset-password", { uid: studentId }),
    onSuccess: (res) => setResetPassword(res.password),
  });

  const toggleRep = useMutation({
    mutationFn: (vars: { groupKey: string; revoke: boolean }) =>
      callAdminApi("grant-class-rep", { uid: studentId, groupKey: vars.groupKey, revoke: vars.revoke }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["student", studentId] }),
  });

  if (isLoading) return <p className="emptyState">Loading…</p>;
  if (error || !data) return <p className="errorBanner">Couldn't load that student.</p>;

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="pageTitle">{data.student.name || data.student.rollNumber}</h1>
          <p className="pageSub">{data.student.rollNumber}</p>
        </div>
        <button type="button" className="btn btnDanger" onClick={() => reset.mutate()} disabled={reset.isPending}>
          {reset.isPending ? "Resetting…" : "Reset password"}
        </button>
      </div>

      {resetPassword && (
        <div className="successBanner">
          New password for {data.student.rollNumber}: <strong>{resetPassword}</strong> — relay this to the
          student now; it won't be shown again.{" "}
          <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => setResetPassword(null)}>
            Dismiss
          </button>
        </div>
      )}
      {savedMsg && <div className="successBanner">{savedMsg}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        <div className="card cardPad">
          <h2 style={{ fontSize: 14, fontWeight: 650, marginBottom: 16 }}>Profile</h2>
          <div style={{ display: "grid", gap: 12 }}>
            <TextField label="Name" value={editable?.name ?? ""} onChange={(v) => setForm({ ...editable, name: v })} />
            <TextField
              label="Department"
              value={editable?.department ?? ""}
              onChange={(v) => setForm({ ...editable, department: v })}
            />
            <TextField
              label="Section"
              value={editable?.section ?? ""}
              onChange={(v) => setForm({ ...editable, section: v })}
            />
            <TextField
              label="Year"
              type="number"
              value={String(editable?.year ?? "")}
              onChange={(v) => setForm({ ...editable, year: Number(v) || 0 })}
            />
            <TextField
              label="Mobile"
              value={editable?.mobileNo ?? ""}
              onChange={(v) => setForm({ ...editable, mobileNo: v })}
            />
            <button
              type="button"
              className="btn btnPrimary"
              disabled={!form || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 24 }}>
          <div className="card cardPad">
            <h2 style={{ fontSize: 14, fontWeight: 650, marginBottom: 16 }}>Attendance (view only)</h2>
            {data.summaries.length === 0 ? (
              <p className="emptyState">No synced attendance yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Attended / held</th>
                  </tr>
                </thead>
                <tbody>
                  {data.summaries.map((s) => (
                    <tr key={s.subjectId}>
                      <td>{s.subjectName}</td>
                      <td>
                        {s.attended} / {s.held}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card cardPad">
            <h2 style={{ fontSize: 14, fontWeight: 650, marginBottom: 16 }}>Class rep</h2>
            {data.groups.length === 0 ? (
              <p className="emptyState">Not in any class group yet — they need to sync a timetable first.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {data.groups.map((g) => (
                  <div key={g.groupKey} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ flex: 1, fontSize: 13, fontFamily: "monospace" }}>{g.groupKey}</span>
                    <span className={`pill ${g.isRep ? "pillSuccess" : "pillNeutral"}`}>
                      {g.isRep ? "Class rep" : "Member"}
                    </span>
                    <button
                      type="button"
                      className="btn"
                      disabled={toggleRep.isPending}
                      onClick={() => toggleRep.mutate({ groupKey: g.groupKey, revoke: g.isRep })}
                    >
                      {g.isRep ? "Revoke" : "Grant"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
