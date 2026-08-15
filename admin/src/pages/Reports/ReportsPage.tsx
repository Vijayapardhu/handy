import { useQuery } from "@tanstack/react-query";
import { getDoc, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { attendanceCorrectionsCol, feedbackCol, studentDocRef } from "@/services/firebase/collections";

/**
 * Read-only, deliberately. `attendanceCorrections` and `feedback` are the two
 * collections that went from unreadable-by-anyone to admin-readable when
 * isAdmin() was added to firestore.rules — this page is why that mattered.
 *
 * There is no approve/reject action for a correction here, and there is no
 * respond/delete action for feedback. Approving a correction is exactly the
 * one feature that would legitimately need to touch a student's attendance
 * summary, which is why it stays unbuilt — see the plan and firestore.rules'
 * closing comment. This page exists so a correction request is at least
 * visible, not so it can be acted on.
 */
async function loadReports() {
  const [corrections, feedback] = await Promise.all([
    getDocs(query(attendanceCorrectionsCol(), where("status", "==", "pending"), orderBy("createdAt", "desc"))),
    getDocs(query(feedbackCol(), limit(50))),
  ]);

  const studentIds = new Set([
    ...corrections.docs.map((d) => d.data().studentId),
    ...feedback.docs.map((d) => d.data().studentId),
  ]);
  const students = await Promise.all([...studentIds].map((uid) => getDoc(studentDocRef(uid))));
  const nameByUid = new Map(students.filter((s) => s.exists()).map((s) => [s.id, s.data()!]));

  return {
    corrections: corrections.docs.map((d) => ({ ...d.data(), student: nameByUid.get(d.data().studentId) })),
    feedback: feedback.docs.map((d) => ({ ...d.data(), student: nameByUid.get(d.data().studentId) })),
  };
}

export function ReportsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["reports"], queryFn: loadReports });

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="pageTitle">Reports</h1>
          <p className="pageSub">View only — nothing here writes back to a student's attendance.</p>
        </div>
      </div>

      {error && <p className="errorBanner">Couldn't load reports.</p>}

      <div style={{ display: "grid", gap: 24 }}>
        <section>
          <h2 style={{ fontSize: 14, fontWeight: 650, marginBottom: 12 }}>Pending attendance corrections</h2>
          <div className="card">
            {isLoading ? (
              <p className="emptyState">Loading…</p>
            ) : !data?.corrections.length ? (
              <p className="emptyState">Nothing pending.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Date</th>
                    <th>Expected status</th>
                    <th>Reason</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {data.corrections.map((c) => (
                    <tr key={c.id}>
                      <td>{c.student ? `${c.student.name} (${c.student.rollNumber})` : c.studentId}</td>
                      <td>{c.date}</td>
                      <td>
                        <span className="pill pillNeutral">{c.expectedStatus}</span>
                      </td>
                      <td style={{ maxWidth: 320 }}>{c.reason}</td>
                      <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 14, fontWeight: 650, marginBottom: 12 }}>Feedback</h2>
          <div className="card">
            {isLoading ? (
              <p className="emptyState">Loading…</p>
            ) : !data?.feedback.length ? (
              <p className="emptyState">Nothing submitted yet.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {data.feedback.map((f) => (
                    <tr key={f.id}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {f.student ? `${f.student.name} (${f.student.rollNumber})` : f.studentId}
                      </td>
                      <td>{f.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
