import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  Loader2,
  Megaphone,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useClassRepRooms, usePostAnnouncement, useUploadAttachment } from "@/hooks/useClassRep";
import {
  ACCEPTED_UPLOAD_TYPES,
  AnnouncementError,
  MAX_ATTACHMENTS,
  MAX_BODY,
  MAX_TITLE,
} from "@/services/announcements/announcementService";
import { announcementSchema, type AnnouncementFormValues } from "@/lib/validators/announcement";
import type { AnnouncementMedia } from "@/types/announcement";
import styles from "./AnnouncePage.module.css";

interface Attachment {
  id: string;
  file: File;
  status: "uploading" | "ready" | "failed";
  error?: string;
  uploaded?: Omit<AnnouncementMedia, "url">;
}

interface LinkRow {
  id: string;
  url: string;
  label: string;
}

const newId = () => crypto.randomUUID();

export function AnnouncePage() {
  const rooms = useClassRepRooms();
  const upload = useUploadAttachment();
  const post = usePostAnnouncement();

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [sent, setSent] = useState<{ recipients: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { groupKey: "", title: "", body: "", important: false },
  });

  const groupKey = watch("groupKey");
  const title = watch("title") ?? "";
  const body = watch("body") ?? "";

  // With one class there is no choice to make, so the field selects itself
  // rather than presenting a list of one.
  useEffect(() => {
    const list = rooms.data;
    if (list?.length === 1 && !groupKey) setValue("groupKey", list[0].groupKey);
  }, [rooms.data, groupKey, setValue]);

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files || !groupKey) return;
      const room = groupKey;
      const space = MAX_ATTACHMENTS - attachments.length;
      const picked = Array.from(files).slice(0, Math.max(0, space));

      for (const file of picked) {
        const id = newId();
        setAttachments((current) => [...current, { id, file, status: "uploading" }]);

        // Uploaded as soon as it is picked, so the wait happens while the rep
        // is still writing rather than all at once when they hit send.
        upload
          .mutateAsync({ file, groupKey: room })
          .then((uploaded) =>
            setAttachments((current) =>
              current.map((a) => (a.id === id ? { ...a, status: "ready", uploaded } : a)),
            ),
          )
          .catch((error: unknown) =>
            setAttachments((current) =>
              current.map((a) =>
                a.id === id
                  ? {
                      ...a,
                      status: "failed",
                      error:
                        error instanceof AnnouncementError
                          ? error.message
                          : "Upload failed. Tap to retry.",
                    }
                  : a,
              ),
            ),
          );
      }

      if (fileInput.current) fileInput.current.value = "";
    },
    [attachments.length, groupKey, upload],
  );

  // Attachments are stored under the group they were uploaded for, so keeping
  // them across a change of class would file them in the wrong room.
  function changeRoom(next: string) {
    setValue("groupKey", next);
    setAttachments([]);
  }

  async function onSubmit(values: AnnouncementFormValues) {
    const ready = attachments.filter((a) => a.status === "ready" && a.uploaded);
    const result = await post.mutateAsync({
      groupKey: values.groupKey,
      title: values.title,
      body: values.body,
      important: values.important,
      media: ready.map((a) => a.uploaded!),
      links: links
        .filter((l) => /^https?:\/\//i.test(l.url.trim()))
        .map((l) => ({ url: l.url.trim(), label: l.label.trim() })),
    });

    setSent({ recipients: result.recipients });
    reset({ groupKey: values.groupKey, title: "", body: "", important: false });
    setAttachments([]);
    setLinks([]);
  }

  if (rooms.isLoading) {
    return (
      <div className="page-narrow">
        <TopHeader title="Post an announcement" back />
        <Card>
          <p className={styles.muted}>
            <Loader2 className={styles.spin} size={16} /> Checking your classes…
          </p>
        </Card>
      </div>
    );
  }

  const list = rooms.data ?? [];

  if (list.length === 0) {
    return (
      <div className="page-narrow">
        <TopHeader title="Post an announcement" back />
        <Card>
          <div className={styles.empty}>
            <Megaphone size={28} aria-hidden="true" />
            <h2 className={styles.emptyTitle}>You&rsquo;re not a class representative</h2>
            <p className={styles.muted}>
              Announcements are posted by the representative for a class, so that notes and notices
              reach everyone taught by the same lecturer at once. If you should have this and
              don&rsquo;t, ask whoever set up Handy for your year.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const uploading = attachments.some((a) => a.status === "uploading");

  return (
    <div className="page-narrow">
      <TopHeader
        title="Post an announcement"
        subtitle="Goes to everyone in the class, on their phone"
        back
      />

      {sent && (
        <Card className={styles.sentCard}>
          <div className={styles.sentRow}>
            <CheckCircle2 size={18} aria-hidden="true" />
            <div>
              <strong>Posted.</strong>{" "}
              {sent.recipients === 0
                ? "Nobody else has synced this class yet, so it's waiting for them."
                : `${sent.recipients} ${sent.recipients === 1 ? "classmate" : "classmates"} notified.`}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
          {list.length > 1 && (
            <fieldset className={styles.rooms}>
              <legend className={styles.labelText}>Which class</legend>
              {list.map((room) => (
                <label key={room.groupKey} className={styles.roomOption}>
                  <input
                    type="radio"
                    name="room"
                    value={room.groupKey}
                    checked={groupKey === room.groupKey}
                    onChange={() => changeRoom(room.groupKey)}
                  />
                  <span>
                    <span className={styles.roomName}>{room.subjectName}</span>
                    {room.facultyName && (
                      <span className={styles.roomFaculty}>{room.facultyName}</span>
                    )}
                  </span>
                </label>
              ))}
              {errors.groupKey && <span className={styles.fieldError}>{errors.groupKey.message}</span>}
            </fieldset>
          )}

          {list.length === 1 && (
            <p className={styles.singleRoom}>
              Posting to <strong>{list[0].subjectName}</strong>
              {list[0].facultyName ? ` · ${list[0].facultyName}` : ""}
            </p>
          )}

          <label className={styles.field}>
            <span className={styles.labelRow}>
              <span className={styles.labelText}>Title</span>
              <span className={styles.counter}>
                {title.length}/{MAX_TITLE}
              </span>
            </span>
            <input
              className={styles.input}
              maxLength={MAX_TITLE}
              placeholder="Lab record due Friday"
              {...register("title")}
            />
            {errors.title && <span className={styles.fieldError}>{errors.title.message}</span>}
            <span className={styles.hint}>
              This is the line that shows on a locked phone — make it readable on its own.
            </span>
          </label>

          <label className={styles.field}>
            <span className={styles.labelRow}>
              <span className={styles.labelText}>Message</span>
              <span className={styles.counter}>
                {body.length}/{MAX_BODY}
              </span>
            </span>
            <textarea
              className={styles.textarea}
              rows={6}
              maxLength={MAX_BODY}
              placeholder="Bring the printed record and the observation book. Submissions after Friday lose 5 marks."
              {...register("body")}
            />
            {errors.body && <span className={styles.fieldError}>{errors.body.message}</span>}
          </label>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.labelText}>
                <Paperclip size={14} aria-hidden="true" /> Attachments
              </span>
              <span className={styles.counter}>
                {attachments.length}/{MAX_ATTACHMENTS}
              </span>
            </div>

            {attachments.length > 0 && (
              <ul className={styles.fileList}>
                {attachments.map((a) => (
                  <li key={a.id} className={styles.fileRow} data-status={a.status}>
                    <span className={styles.fileName}>{a.file.name}</span>
                    <span className={styles.fileMeta}>
                      {a.status === "uploading" && (
                        <>
                          <Loader2 className={styles.spin} size={13} /> uploading
                        </>
                      )}
                      {a.status === "ready" && formatSize(a.file.size)}
                      {a.status === "failed" && (
                        <span className={styles.fileError}>{a.error}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => setAttachments((c) => c.filter((x) => x.id !== a.id))}
                      aria-label={`Remove ${a.file.name}`}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <input
              ref={fileInput}
              type="file"
              multiple
              className={styles.hiddenInput}
              accept={ACCEPTED_UPLOAD_TYPES}
              onChange={(event) => addFiles(event.target.files)}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInput.current?.click()}
              disabled={!groupKey || attachments.length >= MAX_ATTACHMENTS}
            >
              <Paperclip size={15} /> Add photos or files
            </Button>
            <span className={styles.hint}>
              Photos of the board, PDFs, slides or video. Up to 25 MB each.
            </span>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.labelText}>
                <Link2 size={14} aria-hidden="true" /> Links
              </span>
            </div>

            {links.map((link) => (
              <div key={link.id} className={styles.linkRow}>
                <input
                  className={styles.input}
                  placeholder="https://…"
                  value={link.url}
                  onChange={(event) =>
                    setLinks((c) =>
                      c.map((l) => (l.id === link.id ? { ...l, url: event.target.value } : l)),
                    )
                  }
                />
                <input
                  className={styles.input}
                  placeholder="What is it? (optional)"
                  value={link.label}
                  onChange={(event) =>
                    setLinks((c) =>
                      c.map((l) => (l.id === link.id ? { ...l, label: event.target.value } : l)),
                    )
                  }
                />
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => setLinks((c) => c.filter((l) => l.id !== link.id))}
                  aria-label="Remove link"
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            <Button
              type="button"
              variant="secondary"
              onClick={() => setLinks((c) => [...c, { id: newId(), url: "", label: "" }])}
            >
              <Link2 size={15} /> Add a link
            </Button>
          </section>

          <label className={styles.checkboxRow}>
            <input type="checkbox" {...register("important")} />
            <span>
              <span className={styles.labelText}>Mark as important</span>
              <span className={styles.hint}>
                Rings through on silent and shows a red banner. Use it for things that change
                someone&rsquo;s day, not for every notice.
              </span>
            </span>
          </label>

          {post.isError && (
            <p className={styles.submitError} role="alert">
              <AlertTriangle size={15} aria-hidden="true" />{" "}
              {post.error instanceof AnnouncementError
                ? post.error.message
                : "Could not post the announcement. Check your connection and try again."}
            </p>
          )}

          <Button type="submit" fullWidth loading={post.isPending} disabled={uploading}>
            <Send size={16} /> {uploading ? "Waiting for uploads…" : "Post to the class"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
