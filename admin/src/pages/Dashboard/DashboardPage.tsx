import { useQuery } from "@tanstack/react-query";
import { collection, getCountFromServer, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { db } from "@/app/config/firebase";
import { COLLECTIONS } from "@/services/firebase/collections";
import { leaveRequestsCol } from "@/services/firebase/collections";

/**
 * Every number here is a Firestore COUNT() aggregation — one billed read
 * regardless of how many documents match — rather than a materialized stats
 * collection. There's no rollup pipeline to keep in sync; the cost is simply
 * paid at dashboard-load time, which is the right trade for a page an admin
 * opens occasionally, not one serving live traffic.
 */
async function loadDashboardStats() {
  const [students, pendingLeave, pendingCorrections, activeAdmins, recentLeave] = await Promise.all([
    getCountFromServer(collection(db, COLLECTIONS.students)),
    getCountFromServer(query(collection(db, COLLECTIONS.leaveRequests), where("status", "==", "pending"))),
    getCountFromServer(query(collection(db, COLLECTIONS.attendanceCorrections), where("status", "==", "pending"))),
    getCountFromServer(query(collection(db, COLLECTIONS.admins), where("active", "==", true))),
    getDocs(query(leaveRequestsCol(), orderBy("submittedAt", "desc"), limit(60))),
  ]);

  const byWeek = new Map<string, number>();
  for (const doc of recentLeave.docs) {
    const submitted = doc.data().submittedAt;
    const weekOf = weekStart(submitted);
    byWeek.set(weekOf, (byWeek.get(weekOf) ?? 0) + 1);
  }
  const chart = [...byWeek.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([week, count]) => ({ week, count }));

  return {
    students: students.data().count,
    pendingLeave: pendingLeave.data().count,
    pendingCorrections: pendingCorrections.data().count,
    activeAdmins: activeAdmins.data().count,
    chart,
  };
}

function weekStart(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: loadDashboardStats });

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1 className="pageTitle">Dashboard</h1>
          <p className="pageSub">A quick read on where things stand.</p>
        </div>
      </div>

      {error && <p className="errorBanner">Couldn't load the dashboard. Try refreshing.</p>}

      <div className="statGrid">
        <Stat label="Students" value={data?.students} loading={isLoading} />
        <Stat label="Pending leave requests" value={data?.pendingLeave} loading={isLoading} />
        <Stat label="Pending corrections (view only)" value={data?.pendingCorrections} loading={isLoading} />
        <Stat label="Active admins" value={data?.activeAdmins} loading={isLoading} />
      </div>

      <div className="card cardPad">
        <h2 style={{ fontSize: 14, fontWeight: 650, marginBottom: 16 }}>Leave requests, last 60, by week</h2>
        {data?.chart.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
              <Tooltip />
              <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="emptyState">No leave requests yet.</p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, loading }: { label: string; value: number | undefined; loading: boolean }) {
  return (
    <div className="card cardPad">
      <div className="statValue">{loading ? "—" : (value ?? 0)}</div>
      <div className="statLabel">{label}</div>
    </div>
  );
}
