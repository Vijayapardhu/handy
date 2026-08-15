import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDoc, getDocs, orderBy, query, where } from "firebase/firestore";
import { leaveRequestsCol, studentDocRef } from "@/services/firebase/collections";
import { callAdminApi } from "@/services/adminApi";
import type { LeaveRequestStatus } from "@/types/leave";

async function loadPending() {
  const snap = await getDocs(
    query(leaveRequestsCol(), where("status", "==", "pending"), orderBy("submittedAt", "desc")),
  );
  const requests = snap.docs.map((d) => d.data());
  const students = await Promise.all(requests.map((r) => getDoc(studentDocRef(r.studentId))));
  const nameByStudent = new Map(
    students.filter((s) => s.exists()).map((s) => [s.id, s.data()!]),
  );
  return requests.map((r) => ({ ...r, student: nameByStudent.get(r.studentId) ?? null }));
}

export function LeaveRequestsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["leave-requests"], queryFn: loadPending });
  const [busyId, setBusyId] = useState<string | null>(null);

  const review = useMutation({
    mutationFn: (vars: { leaveId: string; decision: LeaveRequestStatus }) =>
      callAdminApi("review-leave", vars),
    onMutate: (vars) => setBusyId(vars.leaveId),
    onSettled: () => {
      setBusyId(null);
      void qc.invalidateQueries({ queryKey: ["leave-requests"] });
    },
  });

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="pageTitle">Leave requests</h1>
          <p className="pageSub">Pending review. This never touches attendance figures either way.</p>
        </div>
      </div>

      {error && <p className="errorBanner">Couldn't load leave requests.</p>}

      <div className="card">
        {isLoading ? (
          <p className="emptyState">Loading…</p>
        ) : !data?.length ? (
          <p className="emptyState">Nothing pending.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Dates</th>
                <th>Reason</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td>{r.student ? `${r.student.name} (${r.student.rollNumber})` : r.studentId}</td>
                  <td>
                    {r.startDate} → {r.endDate}
                  </td>
                  <td style={{ maxWidth: 320 }}>{r.reason}</td>
                  <td>{new Date(r.submittedAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="btn btnPrimary"
                        disabled={busyId === r.id}
                        onClick={() => review.mutate({ leaveId: r.id, decision: "approved" })}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn btnDanger"
                        disabled={busyId === r.id}
                        onClick={() => review.mutate({ leaveId: r.id, decision: "rejected" })}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
