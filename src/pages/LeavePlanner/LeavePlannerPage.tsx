import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, ChevronLeft, ChevronRight, Lightbulb, FilePlus, ListChecks } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { LeaveImpactTable } from "@/components/leaves/LeaveImpactTable";
import { RecommendationBanner } from "@/components/leaves/RecommendationBanner";
import { useLeaveImpact, useAlternativeDates } from "@/hooks/useLeaves";
import { addDaysIso, formatDisplayDate, todayIso } from "@/lib/date";
import { ROUTES } from "@/constants/routes";
import styles from "./LeavePlannerPage.module.css";

export function LeavePlannerPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(() => addDaysIso(todayIso(), 1));
  const [showAlternatives, setShowAlternatives] = useState(false);

  const impactQuery = useLeaveImpact(date);
  const alternativesQuery = useAlternativeDates(showAlternatives ? date : null);

  return (
    <div>
      <TopHeader title="Can I Take Leave?" subtitle="Check how taking leave will affect your attendance" />

      <Card className={styles.dateCard}>
        <p className={styles.dateLabel}>Select Date</p>
        <div className={styles.dateRow}>
          <button className={styles.dateNav} onClick={() => setDate((d) => addDaysIso(d, -1))} aria-label="Previous day">
            <ChevronLeft size={18} />
          </button>
          <span className={styles.dateValue}>
            <Calendar size={16} />
            {formatDisplayDate(date)}
          </span>
          <button className={styles.dateNav} onClick={() => setDate((d) => addDaysIso(d, 1))} aria-label="Next day">
            <ChevronRight size={18} />
          </button>
        </div>
        {impactQuery.data && impactQuery.data.totalClasses > 0 && (
          <p className={styles.classCountNotice}>
            You have <strong>{impactQuery.data.totalClasses} classes</strong> on this day
          </p>
        )}
      </Card>

      {impactQuery.isError && (
        <ErrorState message="Unable to calculate leave impact right now." onRetry={() => impactQuery.refetch()} />
      )}

      {!impactQuery.isError && impactQuery.isLoading && <Skeleton height={220} />}

      {!impactQuery.isError && impactQuery.data && impactQuery.data.subjects.length === 0 && (
        <Card>
          <p className={styles.noClasses}>No classes are scheduled on this day — leave here has zero attendance impact.</p>
        </Card>
      )}

      {!impactQuery.isError && impactQuery.data && impactQuery.data.subjects.length > 0 && (
        <>
          <Card className={styles.impactCard}>
            <div className={styles.impactHeader}>
              <span className={styles.impactHeaderTitle}>Leave Impact</span>
              <span className={styles.legend}>
                <span className={styles.legendDot} data-tone="positive" /> Positive
                <span className={styles.legendDot} data-tone="minor" /> Minor
                <span className={styles.legendDot} data-tone="negative" /> Negative
              </span>
            </div>
            <LeaveImpactTable subjects={impactQuery.data.subjects} />
          </Card>

          <Card className={styles.overallCard}>
            <div className={styles.overallLeft}>
              <p className={styles.overallLabel}>Overall Impact</p>
              <p className={styles.overallSub}>
                {impactQuery.data.overallImpact < 0
                  ? "Your overall attendance will decrease"
                  : "Your overall attendance is unaffected"}
              </p>
            </div>
            <div className={styles.overallRight}>
              <span className={styles.overallImpact} data-negative={impactQuery.data.overallImpact < 0}>
                {impactQuery.data.overallImpact > 0 ? "+" : ""}
                {impactQuery.data.overallImpact}%
              </span>
              <span className={styles.overallRange}>
                {impactQuery.data.overallBefore}% → {impactQuery.data.overallAfter}%
              </span>
            </div>
          </Card>

          <RecommendationBanner
            recommendation={impactQuery.data.recommendation}
            affectedSubjectCount={impactQuery.data.affectedSubjectCount}
          />

          <div className={styles.tip}>
            <Lightbulb size={14} /> Tip: Consider taking leave on days with fewer classes.
          </div>

          <div className={styles.ctaRow}>
            <Button variant="secondary" fullWidth onClick={() => setShowAlternatives((v) => !v)}>
              <ListChecks size={16} /> {showAlternatives ? "Hide Alternative Dates" : "View Alternative Dates"}
            </Button>
            <Button fullWidth onClick={() => navigate(ROUTES.leaveRequestNew, { state: { date } })}>
              <FilePlus size={16} /> Apply Leave
            </Button>
          </div>

          {showAlternatives && (
            <Card className={styles.alternatives}>
              <p className={styles.alternativesTitle}>Better dates for leave</p>
              <p className={styles.alternativesNote}>
                These are calculated suggestions, not official college leave approval.
              </p>
              {alternativesQuery.isLoading && <Skeleton height={80} />}
              {alternativesQuery.data && (
                <ul className={styles.altList}>
                  {alternativesQuery.data.slice(0, 4).map((opt) => (
                    <li key={opt.date} className={styles.altRow}>
                      <button className={styles.altButton} onClick={() => { setDate(opt.date); setShowAlternatives(false); }}>
                        <span className={styles.altDate}>{formatDisplayDate(opt.date)}</span>
                        <span className={styles.altMeta}>
                          {opt.classCount} class{opt.classCount === 1 ? "" : "es"} ·{" "}
                          {opt.impact === null ? "N/A" : `${opt.impact.toFixed(2)}%`} impact
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
