"use client";

import { all, env, mediaUrl, useDatabase } from "@/lib/db";
import { deleteClient, saveClient } from "../actions";
import { FormGuard } from "../FormGuard";
import { Item, More, SortableRows } from "../List";
import { FormModal } from "../Modal";
import { SectionHead } from "../Sections";
import { MediaField } from "../MediaField";
import { Actions, DeleteButton, Field, PageHead, SaveButton, Select, adminStyles as s } from "../ui";

type Row = {
  id: string; name: string; logo: string | null;
  width: number | null; height: number | null;
  row_index: number; position: number;
};

export default function ClientsPage() {
  useDatabase();
  const [rows, e] = [
    all<Row>("SELECT * FROM clients ORDER BY row_index, position"),
    env(),
  ] as const;
  const base = e.MEDIA_BASE_URL || undefined;

  const form = (c?: Row) => (
    <form action={saveClient}>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className={s.grid2}>
        <Field label="Client name" name="name" defaultValue={c?.name} required />
        <Select label="Row" name="row_index" defaultValue={String(c?.row_index ?? 0)}
                options={[{ value: "0", label: "Top row" }, { value: "1", label: "Second row" }]} />
      </div>
      <div style={{ height: 14 }} />
      <MediaField label="Logo" name="logo" defaultValue={c?.logo} max={900}
                  hint="SVG is best; a transparent PNG is converted to WebP" />
      <More label="Size on the page">
        <div className={s.grid2}>
          <Field label="Width (px)" name="width" type="number" defaultValue={c?.width}
                 hint="Leave empty to use the file's own size" />
          <Field label="Height (px)" name="height" type="number" defaultValue={c?.height} />
        </div>
      </More>
      <Actions>
        <FormGuard requireOneOf={["logo"]} message="Add the logo first." />
        <SaveButton label={c ? "Save" : "Add logo"} />
        {c && <DeleteButton action={deleteClient} id={c.id} />}
      </Actions>
    </form>
  );

  return (
    <>
      <PageHead title="Client logos" note="Two rows in the sidebar, under “Clients:”. Drag to set the order within a row.">
        <FormModal label="Add logo" title="Add a client logo" done="Logo added">
          {form()}
        </FormModal>
      </PageHead>
      {rows.length === 0 ? <p className={s.empty}>No logos yet.</p> : (
        [0, 1].map((r) => {
          const inRow = rows.filter((c) => c.row_index === r);
          return (
            <section key={r} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <SectionHead title={r === 0 ? "Top row" : "Second row"} note={`${inRow.length} logo${inRow.length === 1 ? "" : "s"}`} />
              {inRow.length === 0 ? (
                <p className={s.empty}>No logos in this row. Add one and choose this row.</p>
              ) : (
                <SortableRows table="clients" scope={r} ids={inRow.map((c) => c.id)} label="logos">
                  {inRow.map((c) => (
                    <Item key={c.id} id={c.id} title={c.name} thumb={mediaUrl(c.logo, base)}>
                      {form(c)}
                    </Item>
                  ))}
                </SortableRows>
              )}
            </section>
          );
        })
      )}
    </>
  );
}
