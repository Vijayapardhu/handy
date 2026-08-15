import { useRef, useState } from "react";
import {
  BookOpen,
  Download,
  FileText,
  Globe,
  Loader2,
  PlayCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useClassRepRooms, useMyClassGroups } from "@/hooks/useClassRep";
import { useCreateNote, useDeleteNote, useGroupNotes, useUploadNoteFile } from "@/hooks/useClassNotes";
import {
  AnnouncementError,
  ACCEPTED_UPLOAD_TYPES,
  matchGroupKey,
} from "@/services/announcements/announcementService";
import {
  MAX_NOTE_DESCRIPTION,
  MAX_NOTE_FILES,
  MAX_NOTE_TITLE,
} from "@/services/announcements/notesService";
import { formatDisplayDate } from "@/lib/date";
import type { AnnouncementMedia, ClassNoteDoc } from "@/types/announcement";
import styles from "./SubjectNotes.module.css";

interface Props {
  subjectCode: string;
  facultyId: string;
}

interface Pending {
  id: string;
  file: File;
  status: "uploading" | "ready" | "failed";
  error?: string;
  uploaded?: Omit<AnnouncementMedia, "url">;
}

/**
 * The shelf for one subject.
 *
 * Announcements are a noticeboard — they arrive, they are read, they scroll
 * away. This is what a student comes back to in week nine looking for the slide
 * deck, so it lives on the subject rather than in an inbox, and it is quiet:
 * adding material notifies nobody.
 */
export function SubjectNotes({ subjectCode, facultyId }: Props) {
  const groups = useMyClassGroups();
  const groupKey = matchGroupKey(groups.data ?? [], subjectCode, facultyId);
  const notes = useGroupNotes(groupKey);
  const repRooms = useClassRepRooms();

  const [composing, setComposing] = useState(false);
  const isRep = Boolean(groupKey && repRooms.data?.some((r) => r.groupKey === groupKey));

  // No group means this subject predates class groups, or the student has not
  // synced since. An empty shelf would imply nobody has posted, which is a
  // different claim from "we cannot tell which shelf is yours".
  if (!groups.isLoading && !groupKey) return null;

  if (groups.isLoading || notes.isLoading) {
    return (
      <Card className={styles.card}>
        <Skeleton height={18} />
        <div style={{ height: 10 }} />
        <Skeleton height={52} />
      </Card>
    );
  }

  const items = notes.data ?? [];

  return (
    <Card className={styles.card}>
      <div className={styles.head}>
        <BookOpen size={15} aria-hidden="true" />
        <h2 className={styles.title}>Notes &amp; materials</h2>
        {items.length > 0 && <span className={styles.count}>{items.length}</span>}
        {isRep && !composing && (
          <button type="button" className={styles.addButton} onClick={() => setComposing(true)}>
            <Plus size={14} /> Add
          </button>
        )}
      </div>

      {isRep && composing && groupKey && (
        <NoteComposer groupKey={groupKey} onDone={() => setComposing(false)} />
      )}

      {items.length === 0 && !composing && (
        <p className={styles.empty}>
          {isRep
            ? "Nothing here yet. Add the slides, past papers or lab manuals your class keeps asking for."
            : "Your class representative hasn't put anything here yet."}
        </p>
      )}

      {items.length > 0 && (
        <ul className={styles.list}>
          {items.map((note) => (
            <NoteRow key={note.id} note={note} groupKey={groupKey} canRemove={isRep} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function NoteRow({
  note,
  groupKey,
  canRemove,
}: {
  note: ClassNoteDoc;
  groupKey: string | null;
  canRemove: boolean;
}) {
  const remove = useDeleteNote(groupKey);
  // Two-step rather than a browser confirm(): a modal that blocks the page to
  // ask one question is a heavier interruption than the action deserves.
  const [confirming, setConfirming] = useState(false);

  return (
    <li className={styles.note}>
      <div className={styles.noteHead}>
        <span className={styles.noteTitle}>{note.title}</span>
        {canRemove &&
          (confirming ? (
            <span className={styles.confirmRow}>
              <button
                type="button"
                className={styles.confirmYes}
                onClick={() => remove.mutate(note.id)}
                disabled={remove.isPending}
              >
                {remove.isPending ? <Loader2 size={12} className={styles.spin} /> : "Remove"}
              </button>
              <button
                type="button"
                className={styles.confirmNo}
                onClick={() => setConfirming(false)}
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setConfirming(true)}
              aria-label={`Remove ${note.title}`}
            >
              <Trash2 size={14} />
            </button>
          ))}
      </div>

      {note.description && <p className={styles.noteDescription}>{note.description}</p>}

      <div className={styles.files}>
        {note.media.map((media) => (
          <FileChip key={media.key} media={media} />
        ))}
        {note.links.map((link) => (
          <a
            key={link.url}
            className={styles.chip}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Globe size={13} aria-hidden="true" />
            <span className={styles.chipName}>{link.label || link.url}</span>
          </a>
        ))}
      </div>

      <p className={styles.noteMeta}>
        {note.authorName} · {formatDisplayDate(note.createdAt.slice(0, 10))}
      </p>

      {remove.isError && (
        <p className={styles.error} role="alert">
          {remove.error instanceof AnnouncementError
            ? remove.error.message
            : "Could not remove that."}
        </p>
      )}
    </li>
  );
}

function FileChip({ media }: { media: AnnouncementMedia }) {
  const Icon = media.kind === "video" ? PlayCircle : media.kind === "image" ? Download : FileText;

  if (!media.url) {
    return (
      <span className={styles.chipBroken}>
        <FileText size={13} /> {media.name}
      </span>
    );
  }

  return (
    <a className={styles.chip} href={media.url} target="_blank" rel="noopener noreferrer">
      <Icon size={13} aria-hidden="true" />
      <span className={styles.chipName}>{media.name}</span>
      <span className={styles.chipSize}>{formatSize(media.size)}</span>
    </a>
  );
}

function NoteComposer({ groupKey, onDone }: { groupKey: string; onDone: () => void }) {
  const upload = useUploadNoteFile();
  const create = useCreateNote(groupKey);
  const fileInput = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [linkUrl, setLinkUrl] = useState("");

  function addFiles(files: FileList | null) {
    if (!files) return;
    const room = MAX_NOTE_FILES - pending.length;
    for (const file of Array.from(files).slice(0, Math.max(0, room))) {
      const id = crypto.randomUUID();
      setPending((current) => [...current, { id, file, status: "uploading" }]);
      upload
        .mutateAsync({ file, groupKey })
        .then((uploaded) =>
          setPending((c) =>
            c.map((p) => (p.id === id ? { ...p, status: "ready", uploaded } : p)),
          ),
        )
        .catch((error: unknown) =>
          setPending((c) =>
            c.map((p) =>
              p.id === id
                ? {
                    ...p,
                    status: "failed",
                    error: error instanceof AnnouncementError ? error.message : "Upload failed.",
                  }
                : p,
            ),
          ),
        );
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  const uploading = pending.some((p) => p.status === "uploading");
  const ready = pending.filter((p) => p.status === "ready" && p.uploaded);
  const link = linkUrl.trim();
  const hasSomething = ready.length > 0 || /^https?:\/\//i.test(link);

  async function submit() {
    await create.mutateAsync({
      groupKey,
      title: title.trim(),
      description: description.trim(),
      media: ready.map((p) => p.uploaded!),
      links: /^https?:\/\//i.test(link) ? [{ url: link, label: "" }] : [],
    });
    onDone();
  }

  return (
    <div className={styles.composer}>
      <input
        className={styles.input}
        placeholder="Unit 3 slides"
        maxLength={MAX_NOTE_TITLE}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <textarea
        className={styles.input}
        rows={2}
        placeholder="What is it, and when is it useful? (optional)"
        maxLength={MAX_NOTE_DESCRIPTION}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />

      {pending.length > 0 && (
        <ul className={styles.pendingList}>
          {pending.map((p) => (
            <li key={p.id} className={styles.pendingRow} data-status={p.status}>
              <span className={styles.chipName}>{p.file.name}</span>
              <span className={styles.pendingMeta}>
                {p.status === "uploading" && <Loader2 size={12} className={styles.spin} />}
                {p.status === "ready" && formatSize(p.file.size)}
                {p.status === "failed" && <span className={styles.error}>{p.error}</span>}
              </span>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setPending((c) => c.filter((x) => x.id !== p.id))}
                aria-label={`Remove ${p.file.name}`}
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        className={styles.input}
        placeholder="…or paste a link (Drive, YouTube)"
        value={linkUrl}
        onChange={(event) => setLinkUrl(event.target.value)}
      />

      <input
        ref={fileInput}
        type="file"
        multiple
        className={styles.hiddenInput}
        accept={ACCEPTED_UPLOAD_TYPES}
        onChange={(event) => addFiles(event.target.files)}
      />

      {create.isError && (
        <p className={styles.error} role="alert">
          {create.error instanceof AnnouncementError
            ? create.error.message
            : "Could not add the material."}
        </p>
      )}

      <div className={styles.composerActions}>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => fileInput.current?.click()}
          disabled={pending.length >= MAX_NOTE_FILES}
        >
          <Plus size={14} /> Files
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={submit}
          loading={create.isPending}
          disabled={uploading || !title.trim() || !hasSomething}
        >
          {uploading ? "Uploading…" : "Add to subject"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
