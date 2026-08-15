import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminAuth } from "@/app/providers/AdminAuthProvider";
import { callAdminApi } from "@/services/adminApi";
import type { AdminDoc } from "@/types/admin";

async function loadAdmins() {
  const res = await callAdminApi<{ admins: AdminDoc[] }>("list-admins");
  return res.admins;
}

export function AdminsPage() {
  const { admin: self } = useAdminAuth();
  const qc = useQueryClient();
  const { data: admins, isLoading, error } = useQuery({ queryKey: ["admins"], queryFn: loadAdmins });

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const grant = useMutation({
    mutationFn: () => callAdminApi<{ password: string }>("grant-admin", { email, name }),
    onSuccess: (res) => {
      setNewPassword(res.password);
      setEmail("");
      setName("");
      void qc.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (e: Error) => {
      setFormError(
        e.message === "student_domain_reserved"
          ? "That domain is reserved for student accounts — use a real email."
          : e.message === "email_in_use"
            ? "That email already has an account."
            : "Couldn't create that admin.",
      );
    },
  });

  const revoke = useMutation({
    mutationFn: (uid: string) => callAdminApi("revoke-admin", { uid }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admins"] }),
  });

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="pageTitle">Admins</h1>
          <p className="pageSub">Who else can sign in here.</p>
        </div>
      </div>

      {newPassword && (
        <div className="successBanner">
          Admin created. Their password: <strong>{newPassword}</strong> — relay it now; it won't be shown again.{" "}
          <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => setNewPassword(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24, alignItems: "start" }}>
        <div className="card">
          {error && <p className="errorBanner">Couldn't load admins.</p>}
          {isLoading ? (
            <p className="emptyState">Loading…</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {admins?.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.name} {a.id === self?.uid && <span className="pill pillInfo">You</span>}
                    </td>
                    <td>{a.email}</td>
                    <td>
                      <span className={`pill ${a.active ? "pillSuccess" : "pillNeutral"}`}>
                        {a.active ? "Active" : "Revoked"}
                      </span>
                    </td>
                    <td>
                      {a.active && a.id !== self?.uid && (
                        <button type="button" className="btn btnDanger" onClick={() => revoke.mutate(a.uid)}>
                          Revoke
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
          <h2 style={{ fontSize: 14, fontWeight: 650, marginBottom: 16 }}>Add admin</h2>
          {formError && <p className="errorBanner">{formError}</p>}
          <div style={{ display: "grid", gap: 12 }}>
            <label className="field">
              <span className="label">Name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Email</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button
              type="button"
              className="btn btnPrimary"
              disabled={!name || !email || grant.isPending}
              onClick={() => {
                setFormError(null);
                grant.mutate();
              }}
            >
              {grant.isPending ? "Creating…" : "Create admin"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
