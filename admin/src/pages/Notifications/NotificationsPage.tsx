import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { callAdminApi } from "@/services/adminApi";

type TargetMode = "all" | "cohort" | "student";

export function NotificationsPage() {
  const [mode, setMode] = useState<TargetMode>("cohort");
  const [section, setSection] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [uid, setUid] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () => {
      const target =
        mode === "all"
          ? { type: "all" as const }
          : mode === "student"
            ? { type: "student" as const, uid }
            : {
                type: "cohort" as const,
                section: section || undefined,
                department: department || undefined,
                year: year || undefined,
              };
      return callAdminApi<{ recipients: number; delivered: number }>("notify", { target, title, body });
    },
    onSuccess: (res) => {
      setResult(`Sent to ${res.recipients} student(s), ${res.delivered} push notifications delivered.`);
      setTitle("");
      setBody("");
      setConfirmOpen(false);
    },
  });

  const targetSummary =
    mode === "all"
      ? "every student"
      : mode === "student"
        ? uid
          ? `student ${uid}`
          : "a specific student"
        : [section && `section ${section}`, department && `department ${department}`, year && `year ${year}`]
            .filter(Boolean)
            .join(", ") || "a cohort (no filters — this is everyone)";

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="pageTitle">Notifications</h1>
          <p className="pageSub">Push + in-app inbox entry, sent to one student or a whole cohort.</p>
        </div>
      </div>

      {result && <div className="successBanner">{result}</div>}

      <div className="card cardPad" style={{ maxWidth: 560 }}>
        <div className="toolbar">
          {(["cohort", "student", "all"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className="btn"
              style={{ background: mode === m ? "var(--color-primary-light)" : undefined }}
              onClick={() => setMode(m)}
            >
              {m === "cohort" ? "Cohort" : m === "student" ? "One student" : "Everyone"}
            </button>
          ))}
        </div>

        {mode === "cohort" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
            <input className="input" placeholder="Section" value={section} onChange={(e) => setSection(e.target.value)} />
            <input
              className="input"
              placeholder="Department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
            <input className="input" placeholder="Year" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
        )}
        {mode === "student" && (
          <input
            className="input"
            placeholder="Student uid (from their detail page URL)"
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            style={{ marginBottom: 12, width: "100%" }}
          />
        )}

        <div style={{ display: "grid", gap: 12 }}>
          <label className="field">
            <span className="label">Title</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">Message</span>
            <textarea className="textarea" value={body} onChange={(e) => setBody(e.target.value)} />
          </label>

          {!confirmOpen ? (
            <button
              type="button"
              className="btn btnPrimary"
              disabled={!title || (mode === "student" && !uid)}
              onClick={() => setConfirmOpen(true)}
            >
              Review and send
            </button>
          ) : (
            <div className="errorBanner" style={{ display: "grid", gap: 8 }}>
              <span>
                This sends to <strong>{targetSummary}</strong>. Confirm?
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btnPrimary" disabled={send.isPending} onClick={() => send.mutate()}>
                  {send.isPending ? "Sending…" : "Yes, send"}
                </button>
                <button type="button" className="btn" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
