import { Icon, type IconSvgElement } from "./Icon";
import { NAV } from "./nav";
import styles from "./admin.module.css";

/* Small building blocks so each admin page stays short and they all look
   the same. Server components - plain markup, no client JS. */

/**
 * The top of a page: its Hugeicons icon (the sidebar's, found by the title),
 * the title and a line about it, and the page's own buttons on the right.
 * An engraved rule runs under it, the site's hairline.
 */
export function PageHead({
  title,
  note,
  icon,
  children,
}: {
  title: string;
  note?: string;
  icon?: IconSvgElement;
  children?: React.ReactNode;
}) {
  const glyph = icon ?? NAV.flatMap((g) => g.items).find((i) => i.label === title)?.icon;
  return (
    <div className={styles.pageHead}>
      <div className={styles.pageHeadMain}>
        {glyph && (
          <span className={styles.pageIcon}>
            <Icon icon={glyph} size={20} />
          </span>
        )}
        <div>
          <h1 className={styles.pageTitle}>{title}</h1>
          {note && <p className={styles.pageNote}>{note}</p>}
        </div>
      </div>
      {children && <div className={styles.pageActions}>{children}</div>}
    </div>
  );
}

/**
 * A part of a page, drawn in the site's line art: an engraved frame, its
 * title over an engraved rule. `id` makes it a place the page's section
 * links can jump to; `actions` sit at the right of the title.
 */
export function Card({
  title,
  note,
  id,
  actions,
  flush,
  children,
}: {
  title?: string;
  note?: string;
  id?: string;
  actions?: React.ReactNode;
  /** the body runs to the frame's edges: a table, a lattice */
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.card} id={id}>
      {(title || note || actions) && (
        <header className={styles.cardHead}>
          <div>
            {title && <h2 className={styles.cardTitle}>{title}</h2>}
            {note && <p className={styles.cardNote}>{note}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={flush ? styles.cardFlush : styles.cardBody}>{children}</div>
    </section>
  );
}

export function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  hint,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  type?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={name}>
        {label}
      </label>
      <input
        className={styles.input}
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
      />
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

export function TextArea({
  label,
  name,
  defaultValue,
  hint,
  rows,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  hint?: string;
  rows?: number;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={name}>
        {label}
      </label>
      <textarea
        className={styles.textarea}
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
      />
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

export function Select({
  label,
  name,
  defaultValue,
  options,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  options: { value: string; label: string }[];
  hint?: string;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={name}>
        {label}
      </label>
      <select
        className={styles.select}
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

export function Check({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className={styles.checkbox}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

export function Actions({ children }: { children: React.ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}

export { SaveButton, DeleteButton } from "./FormButtons";
export { styles as adminStyles };
