import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { loadCohortAnalytics } from "./analytics";
import { ROUTES } from "@/constants/routes";

const BAND_COLORS = ["#dc2626", "#ea580c", "#d97706", "#16a34a", "#059669"];

export function AnalyticsPage() {
  const [semesterId, setSemesterId] = useState("");
  const [committed, setCommitted] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["analytics", committed],
    queryFn: () => loadCohortAnalytics(committed),
    enabled: !!committed,
  });

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="pageTitle">Analytics</h1>
          <p className="pageSub">
            Scoped to one semester at a time — the same reason Subjects and Timetables require it before querying
            anything, rather than scanning every student on every visit.
          </p>
        </div>
      </div>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Semester id, e.g. 2026-sem1"
          value={semesterId}
          onChange={(e) => setSemesterId(e.target.value)}
          style={{ minWidth: 260 }}
        />
        <button type="button" className="btn btnPrimary" onClick={() => setCommitted(semesterId.trim())}>
          Analyze
        </button>
      </div>

      {error && <p className="errorBanner">Couldn't load analytics for that semester.</p>}
      {committed && isLoading && <p className="emptyState">Crunching {committed}…</p>}
      {committed && !isLoading && !data && <p className="emptyState">No students in that semester.</p>}

      {data && (
        <div style={{ display: "grid", gap: 24 }}>
          <div className="statGrid">
            <Stat label="Students" value={data.cohortSize} />
            <Stat label="Below 75%" value={data.atRisk.length} />
            <Stat label="Synced this week" value={data.freshness.thisWeek} />
            <Stat label="Never synced" value={data.freshness.never} />
            <Stat
              label="Class groups with a rep"
              value={`${data.classRepCoverage.groupsWithRep} / ${data.classRepCoverage.totalGroups}`}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24, alignItems: "start" }}>
            <div className="card cardPad">
              <h2 style={{ fontSize: 14, fontWeight: 650, marginBottom: 16 }}>Attendance distribution</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.distribution.map((_, i) => (
                      <Cell key={i} fill={BAND_COLORS[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card cardPad">
              <h2 style={{ fontSize: 14, fontWeight: 650, marginBottom: 16 }}>Sync freshness</h2>
              <div style={{ display: "grid", gap: 8 }}>
                <FreshnessRow label="This week" value={data.freshness.thisWeek} total={data.cohortSize} tone="pillSuccess" />
                <FreshnessRow label="This month" value={data.freshness.thisMonth} total={data.cohortSize} tone="pillNeutral" />
                <FreshnessRow label="Older" value={data.freshness.older} total={data.cohortSize} tone="pillWarning" />
                <FreshnessRow label="Never" value={data.freshness.never} total={data.cohortSize} tone="pillDanger" />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
            <div className="card cardPad">
              <h2 style={{ fontSize: 14, fontWeight: 650, marginBottom: 16 }}>By department</h2>
              <BreakdownList rows={data.byDepartment} />
            </div>
            <div className="card cardPad">
              <h2 style={{ fontSize: 14, fontWeight: 650, marginBottom: 16 }}>By section</h2>
              <BreakdownList rows={data.bySection} />
            </div>
          </div>

          <div className="card">
            <div style={{ padding: "16px 20px 0" }}>
              <h2 style={{ fontSize: 14, fontWeight: 650 }}>At risk — below 75%</h2>
            </div>
            {data.atRisk.length === 0 ? (
              <p className="emptyState">Nobody below 75% in this cohort.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Attended / held</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.atRisk.map((a) => (
                    <tr key={a.student.id}>
                      <td>
                        <Link to={ROUTES.studentDetail(a.student.id)}>
                          {a.student.name} ({a.student.rollNumber})
                        </Link>
                      </td>
                      <td>
                        {a.attended} / {a.held}
                      </td>
                      <td>
                        <span className="pill pillDanger">{a.percentage?.toFixed(1)}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card cardPad">
      <div className="statValue">{value}</div>
      <div className="statLabel">{label}</div>
    </div>
  );
}

function FreshnessRow({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span className={`pill ${tone}`} style={{ minWidth: 40, justifyContent: "center" }}>
        {value}
      </span>
      <span style={{ fontSize: 13, flex: 1 }}>{label}</span>
      <span style={{ fontSize: 12, color: "var(--color-text-faint)" }}>{pct}%</span>
    </div>
  );
}

function BreakdownList({ rows }: { rows: { label: string; count: number }[] }) {
  if (!rows.length) return <p className="emptyState">No data.</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "grid", gridTemplateColumns: "100px 1fr 32px", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.label}
          </span>
          <div style={{ background: "var(--color-bg)", borderRadius: 4, height: 8 }}>
            <div
              style={{
                width: `${(r.count / max) * 100}%`,
                background: "var(--color-primary)",
                height: "100%",
                borderRadius: 4,
              }}
            />
          </div>
          <span style={{ fontSize: 12.5, textAlign: "right" }}>{r.count}</span>
        </div>
      ))}
    </div>
  );
}
