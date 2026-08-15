import { useParams } from "react-router-dom";
import { AlertTriangle, ExternalLink, FileText, Globe, PlayCircle } from "@/components/ui/icons";
import { TopHeader } from "@/components/layout/TopHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAnnouncement } from "@/hooks/useClassRep";
import { formatDisplayDate } from "@/lib/date";
import type { AnnouncementLink, AnnouncementMedia } from "@/types/announcement";
import styles from "./AnnouncementPage.module.css";

/**
 * One announcement, in full.
 *
 * The notification carries a sentence; this carries what was actually posted —
 * the whole message, the photographs of the board, the file, the links. That
 * split is deliberate: a lock-screen preview has to be readable at a glance,
 * and everything that cannot be is here.
 */
export function AnnouncementPage() {
  const { announcementId } = useParams<{ announcementId: string }>();
  const { data, isLoading } = useAnnouncement(announcementId);

  if (isLoading) {
    return (
      <div className="page-narrow">
        <TopHeader title="Announcement" back />
        <Card>
          <Skeleton height={28} />
          <div style={{ height: 12 }} />
          <Skeleton height={96} />
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-narrow">
        <TopHeader title="Announcement" back />
        <EmptyState
          icon={AlertTriangle}
          title="Not available"
          // Covers both "deleted" and "not in that class" — the rules refuse
          // the read either way, and the app has no business saying which.
          description="This announcement is no longer available to you."
        />
      </div>
    );
  }

  const images = data.media.filter((m) => m.kind === "image" && m.url);
  const others = data.media.filter((m) => m.kind !== "image" || !m.url);

  return (
    <div className="page-narrow">
      <TopHeader title="Announcement" back />

      <Card>
        <article className={styles.article}>
          {data.important && (
            <p className={styles.important}>
              <AlertTriangle size={15} aria-hidden="true" /> Marked important
            </p>
          )}

          <h1 className={styles.title}>{data.title}</h1>
          <p className={styles.byline}>
            {[data.authorName, data.authorRoll, formatDisplayDate(data.createdAt.slice(0, 10))]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {data.body && <p className={styles.body}>{data.body}</p>}

          {/* A photograph of the board is the message, not an appendix to it,
              so images are shown rather than listed. */}
          {images.map((media) => (
            <img
              key={media.key}
              src={media.url!}
              alt={media.name}
              className={styles.image}
              loading="lazy"
            />
          ))}

          {others.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Attached</h2>
              {others.map((media) => (
                <Attachment key={media.key} media={media} />
              ))}
            </section>
          )}

          {data.links.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Links</h2>
              {data.links.map((link) => (
                <LinkRow key={link.url} link={link} />
              ))}
            </section>
          )}

          <p className={styles.footnote}>
            Posted to your class by its representative. Handy passes it on unchanged and does not
            check it.
          </p>
        </article>
      </Card>
    </div>
  );
}

function Attachment({ media }: { media: AnnouncementMedia }) {
  const Icon = media.kind === "video" ? PlayCircle : FileText;

  if (!media.url) {
    return (
      <p className={styles.brokenAttachment}>
        <Icon size={16} aria-hidden="true" /> {media.name} — unavailable
      </p>
    );
  }

  return (
    <a className={styles.attachment} href={media.url} target="_blank" rel="noopener noreferrer">
      <Icon size={17} aria-hidden="true" />
      <span className={styles.attachmentBody}>
        <span className={styles.attachmentName}>{media.name}</span>
        <span className={styles.attachmentSize}>{formatSize(media.size)}</span>
      </span>
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  );
}

function LinkRow({ link }: { link: AnnouncementLink }) {
  return (
    <a className={styles.attachment} href={link.url} target="_blank" rel="noopener noreferrer">
      <Globe size={17} aria-hidden="true" />
      <span className={styles.attachmentBody}>
        {link.label && <span className={styles.attachmentName}>{link.label}</span>}
        {/* The address is always shown, even when there is a label. A link
            whose destination is hidden behind friendly words is the shape of
            every phishing message ever sent. */}
        <span className={styles.attachmentUrl}>{link.url}</span>
      </span>
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  );
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return "Open";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
