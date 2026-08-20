import { useState, type FormEvent } from "react";
import { Code2, ExternalLink, Link2 } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CODING_PLATFORMS, PLATFORM_META, type CodingPlatform } from "@/types/coding";
import styles from "./ConnectPlatformsCard.module.css";

/**
 * Where a student types the five usernames Handy reads their practice from.
 *
 * Usernames only — the copy says so in the card, not in a tooltip. Every one
 * of these profiles is public, so a tracker never needs a password, and a
 * student who is asked for one on a page like this should close the tab.
 * (Contrast HubPortalCard, which *does* take a password, because Maya has no
 * public page and there is no other way in.)
 *
 * Blank means unlinked: clearing a field and saving removes that platform,
 * rather than needing a separate delete for each of five rows.
 */
export function ConnectPlatformsCard({
  handles,
  onSave,
  saving,
  error,
  compact = false,
}: {
  handles: Partial<Record<CodingPlatform, string>>;
  onSave: (handles: Partial<Record<CodingPlatform, string>>) => void;
  saving: boolean;
  error: string | null;
  /** Inside the settings sheet the heading is redundant — the sheet already said it. */
  compact?: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(CODING_PLATFORMS.map((platform) => [platform, handles[platform] ?? ""])),
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const cleaned: Partial<Record<CodingPlatform, string>> = {};
    for (const platform of CODING_PLATFORMS) {
      const value = draft[platform]?.trim();
      if (value) cleaned[platform] = value;
    }
    onSave(cleaned);
  }

  const linkedCount = CODING_PLATFORMS.filter((platform) => draft[platform]?.trim()).length;

  return (
    <Card className={styles.card}>
      {!compact && (
        <div className={styles.header}>
          <span className={styles.headerIcon}>
            <Code2 size={20} />
          </span>
          <div>
            <p className={styles.title}>Connect your coding profiles</p>
            <p className={styles.subtitle}>
              Public usernames only — never a password. Leave a row blank to skip it.
            </p>
          </div>
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        {CODING_PLATFORMS.map((platform) => {
          const meta = PLATFORM_META[platform];
          const value = draft[platform] ?? "";
          return (
            <div key={platform} className={styles.field}>
              <label className={styles.labelRow} htmlFor={`handle-${platform}`}>
                <span className={styles.labelText}>{meta.label}</span>
                {value.trim() && (
                  <a
                    className={styles.peek}
                    href={meta.profileUrl(value.trim())}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Open <ExternalLink size={11} />
                  </a>
                )}
              </label>
              <input
                id={`handle-${platform}`}
                className={styles.input}
                value={value}
                placeholder={meta.handleHint}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                onChange={(event) =>
                  setDraft((previous) => ({ ...previous, [platform]: event.target.value }))
                }
              />
            </div>
          );
        })}

        {error && <p className={styles.error}>{error}</p>}

        <Button type="submit" loading={saving} fullWidth>
          <Link2 size={15} />
          {linkedCount === 0 ? "Save (nothing linked)" : `Save ${linkedCount} profile${linkedCount === 1 ? "" : "s"}`}
        </Button>
      </form>
    </Card>
  );
}
