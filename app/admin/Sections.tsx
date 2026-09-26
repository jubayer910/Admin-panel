import styles from "./Sections.module.css";

/** Links to the cards of a long page, pinned under the top bar. */
export function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav className={styles.sectionNav} aria-label="On this page">
      {items.map((i) => (
        <a key={i.id} href={`#${i.id}`} className={styles.sectionLink}>
          {i.label}
        </a>
      ))}
    </nav>
  );
}

/** The heading of a part of a page, with that part's own buttons. */
export function SectionHead({ title, note, id, children }: { title: string; note?: string; id?: string; children?: React.ReactNode }) {
  return (
    <div className={styles.sectionHead} id={id}>
      <div>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {note && <p className={styles.sectionNote}>{note}</p>}
      </div>
      {children && <div className={styles.sectionActions}>{children}</div>}
    </div>
  );
}
