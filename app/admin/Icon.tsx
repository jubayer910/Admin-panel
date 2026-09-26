import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

/**
 * A Hugeicons icon (the stroke-rounded set the Figma library uses), in the
 * admin's one weight: 1.5 stroke, current text colour. Server-safe.
 */
export function Icon({ icon, size = 18, className }: { icon: IconSvgElement; size?: number; className?: string }) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.5} color="currentColor" className={className} aria-hidden />;
}

export type { IconSvgElement };
