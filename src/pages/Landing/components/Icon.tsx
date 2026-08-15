import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

/**
 * Thin wrapper over HugeIcons so the landing page has one place that decides
 * how an icon looks.
 *
 * Everything here is stroked at 1.5 and inherits `currentColor`, which is what
 * keeps a row of icons looking like a set rather than a collection — the two
 * things that most often give away mixed iconography are inconsistent stroke
 * weights and hardcoded fills that ignore the surrounding text colour.
 *
 * `aria-hidden` is the default because every icon on this page sits beside a
 * label. Pass a `label` only for the rare icon that carries meaning alone.
 */
export function Icon({
  icon,
  size = 20,
  label,
  className,
}: {
  icon: IconSvgElement;
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      strokeWidth={1.5}
      color="currentColor"
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
    />
  );
}
