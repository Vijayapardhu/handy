import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDocs, orderBy, query } from "firebase/firestore";
import { materialsCol } from "@/services/firebase/collections";
import { callAdminApi } from "@/services/adminApi";

async function loadMaterials() {
  const snap = await getDocs(query(materialsCol(), orderBy("uploadedAt", "desc")));
  return snap.docs.map((d) => d.data());
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function MaterialsPage() {
  const qc = useQueryClient();
  const { data: materials, isLoading, error } = useQuery({ queryKey: ["materials"], queryFn: loadMaterials });

  const [mode, setMode] = useState<"file" | "link">("link");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      if (mode === "link") {
        return callAdminApi("materials", { action: "link", data: { title, description, url: linkUrl } });
      }
      if (!file) throw new Error("no_file");
      const fileBase64 = await fileToBase64(file);
      return callAdminApi("materials", {
        action: "upload",
        data: { fileName: file.name, contentType: file.type, fileBase64, title, description },
      });
    },
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setLinkUrl("");
      setFile(null);
      void qc.invalidateQueries({ queryKey: ["materials"] });
    },
    onError: () => setFormError("Couldn't publish that material."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => callAdminApi("materials", { action: "delete", id }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["materials"] }),
  });

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="pageTitle">Materials</h1>
          <p className="pageSub">Visible to every signed-in student.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start" }}>
        <div className="card">
          {error && <p className="errorBanner">Couldn't load materials.</p>}
          {isLoading ? (
            <p className="emptyState">Loading…</p>
          ) : !materials?.length ? (
            <p className="emptyState">Nothing published yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id}>
                    <td>{m.title}</td>
                    <td>
                      <span className="pill pillInfo">{m.type}</span>
                    </td>
                    <td>
                      <a href={m.url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </td>
                    <td>
                      <button type="button" className="btn btnDanger" onClick={() => remove.mutate(m.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card cardPad">
          <h2 style={{ fontSize: 14, fontWeight: 650, marginBottom: 16 }}>Publish material</h2>
          {formError && <p className="errorBanner">{formError}</p>}
          <div className="toolbar">
            <button
              type="button"
              className="btn"
              style={{ background: mode === "link" ? "var(--color-primary-light)" : undefined }}
              onClick={() => setMode("link")}
            >
              Link
            </button>
            <button
              type="button"
              className="btn"
              style={{ background: mode === "file" ? "var(--color-primary-light)" : undefined }}
              onClick={() => setMode("file")}
            >
              File upload
            </button>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            <label className="field">
              <span className="label">Title</span>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Description</span>
              <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            {mode === "link" ? (
              <label className="field">
                <span className="label">URL</span>
                <input
                  className="input"
                  placeholder="https://…"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
              </label>
            ) : (
              <label className="field">
                <span className="label">File (up to ~15MB)</span>
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
            <button
              type="button"
              className="btn btnPrimary"
              disabled={!title || (mode === "link" ? !linkUrl : !file) || upload.isPending}
              onClick={() => {
                setFormError(null);
                upload.mutate();
              }}
            >
              {upload.isPending ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
