import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDocs, orderBy, query } from "firebase/firestore";
import { appUpdatesCol } from "@/services/firebase/collections";
import { callAdminApi } from "@/services/adminApi";
import type { AppUpdatePlatform } from "@/types/appUpdate";

async function loadUpdates() {
  const snap = await getDocs(query(appUpdatesCol(), orderBy("publishedAt", "desc")));
  return snap.docs.map((d) => d.data());
}

export function UpdatesPage() {
  const qc = useQueryClient();
  const { data: updates, isLoading, error } = useQuery({ queryKey: ["updates"], queryFn: loadUpdates });

  const [version, setVersion] = useState("");
  const [platform, setPlatform] = useState<AppUpdatePlatform>("android");
  const [changelog, setChangelog] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [notify, setNotify] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const publish = useMutation({
    mutationFn: () =>
      callAdminApi<{ recipients: number; delivered: number }>("updates", {
        action: "create",
        data: { version, platform, changelog, downloadUrl },
        notifyStudents: notify,
      }),
    onSuccess: (res) => {
      setResult(
        notify ? `Published, and notified ${res.recipients} student(s) (${res.delivered} delivered).` : "Published.",
      );
      setVersion("");
      setChangelog("");
      setDownloadUrl("");
      setNotify(false);
      void qc.invalidateQueries({ queryKey: ["updates"] });
    },
  });

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="pageTitle">Updates</h1>
          <p className="pageSub">
            Release records. The landing page and any in-app update banner reading these is a fast-follow, not
            wired up yet — see the plan.
          </p>
        </div>
      </div>

      {result && <div className="successBanner">{result}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start" }}>
        <div className="card">
          {error && <p className="errorBanner">Couldn't load updates.</p>}
          {isLoading ? (
            <p className="emptyState">Loading…</p>
          ) : !updates?.length ? (
            <p className="emptyState">No releases published yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Platform</th>
                  <th>Published</th>
                  <th>Notified</th>
                </tr>
              </thead>
              <tbody>
                {updates.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <a href={u.downloadUrl} target="_blank" rel="noreferrer">
                        {u.version}
                      </a>
                    </td>
                    <td>
                      <span className="pill pillInfo">{u.platform}</span>
                    </td>
                    <td>{new Date(u.publishedAt).toLocaleDateString()}</td>
                    <td>{u.notifiedStudents ? "Yes" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card cardPad">
          <h2 style={{ fontSize: 14, fontWeight: 650, marginBottom: 16 }}>Publish release</h2>
          <div style={{ display: "grid", gap: 12 }}>
            <label className="field">
              <span className="label">Version</span>
              <input className="input" placeholder="1.1.0" value={version} onChange={(e) => setVersion(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Platform</span>
              <select className="select" value={platform} onChange={(e) => setPlatform(e.target.value as AppUpdatePlatform)}>
                <option value="android">Android</option>
                <option value="extension">Extension</option>
                <option value="web">Web</option>
              </select>
            </label>
            <label className="field">
              <span className="label">Download URL</span>
              <input
                className="input"
                placeholder="https://…"
                value={downloadUrl}
                onChange={(e) => setDownloadUrl(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="label">Changelog</span>
              <textarea className="textarea" value={changelog} onChange={(e) => setChangelog(e.target.value)} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
              Notify every student
            </label>
            <button
              type="button"
              className="btn btnPrimary"
              disabled={!version || !downloadUrl || publish.isPending}
              onClick={() => publish.mutate()}
            >
              {publish.isPending ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
