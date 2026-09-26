"use client";

/**
 * Wraps the reorder buttons that live in a <summary>. Without this, clicking
 * one would also toggle the row open.
 */
export function RowTools({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={className}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {children}
    </span>
  );
}
