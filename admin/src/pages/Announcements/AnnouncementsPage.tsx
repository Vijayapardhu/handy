import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getDocs, limit, query, where } from "firebase/firestore";
import { studentsCol, classGroupMembersCol, subjectsCol } from "@/services/firebase/collections";
import { callAdminApi } from "@/services/adminApi";

async function findStudentGroups(rollNumber: string) {
  const trimmed = rollNumber.trim().toUpperCase();
  if (!trimmed) return null;

  // An exact lookup, not a prefix search — the UI asks for one specific
  // student's roll number, so a plain equality query is the right tool
  // (no composite index needed; Firestore indexes every field for equality
  // queries automatically).
  const studentSnap = await getDocs(query(studentsCol(), where("rollNumber", "==", trimmed), limit(1)));
  const student = studentSnap.docs[0]?.data();
  if (!student) return { student: null, groups: [] };

  const memberships = await getDocs(query(classGroupMembersCol(), where("uid", "==", student.uid)));
  const groupKeys = memberships.docs.map((d) => d.data().groupKey);

  const subjects = await getDocs(query(subjectsCol(), where("semesterId", "==", student.semesterId)));
  const byCode = new Map(subjects.docs.map((d) => [d.data().code, d.data().name]));

  const groups = groupKeys.map((key) => {
    const code = key.split("-")[1] ?? key;
    return { key, label: byCode.get(code) ?? code };
  });

  return { student, groups };
}

export function AnnouncementsPage() {
  const [rollNumber, setRollNumber] = useState("");
  const [committedRoll, setCommittedRoll] = useState("");
  const { data: lookup, isFetching } = useQuery({
    queryKey: ["announce-lookup", committedRoll],
    queryFn: () => findStudentGroups(committedRoll),
    enabled: !!committedRoll,
  });

  const [groupKey, setGroupKey] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [important, setImportant] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const post = useMutation({
    mutationFn: () =>
      callAdminApi<{ recipients: number; delivered: number }>("post-announcement", {
        groupKey,
        title,
        body,
        important,
      }),
    onSuccess: (res) => {
      setResult(`Posted to ${res.recipients} student(s), ${res.delivered} push notifications delivered.`);
      setTitle("");
      setBody("");
      setImportant(false);
    },
  });

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="pageTitle">Announcements</h1>
          <p className="pageSub">
            Posts go to a class group — find one by looking up any student who's in it.
          </p>
        </div>
      </div>

      {result && <div className="successBanner">{result}</div>}

      <div className="card cardPad" style={{ maxWidth: 640 }}>
        <div className="toolbar">
          <input
            className="input"
            placeholder="Roll number of any student in the class…"
            value={rollNumber}
            onChange={(e) => setRollNumber(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="button" className="btn" onClick={() => setCommittedRoll(rollNumber)}>
            Find groups
          </button>
        </div>

        {isFetching && <p className="emptyState">Looking up…</p>}
        {lookup && !lookup.student && <p className="errorBanner">No student with that roll number.</p>}
        {lookup?.student && lookup.groups.length === 0 && (
          <p className="errorBanner">
            {lookup.student.name} has no class groups yet — they need to sync a timetable first.
          </p>
        )}

        {lookup?.groups && lookup.groups.length > 0 && (
          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <label className="field">
              <span className="label">Class</span>
              <select className="select" value={groupKey} onChange={(e) => setGroupKey(e.target.value)}>
                <option value="">Pick a class…</option>
                {lookup.groups.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="label">Title</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className="field">
              <span className="label">Message</span>
              <textarea className="textarea" value={body} onChange={(e) => setBody(e.target.value)} />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
              <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
              Mark as important (high-priority push)
            </label>

            <button
              type="button"
              className="btn btnPrimary"
              disabled={!groupKey || !title || post.isPending}
              onClick={() => post.mutate()}
            >
              {post.isPending ? "Posting…" : "Post announcement"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
