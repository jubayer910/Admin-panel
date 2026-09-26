"use client";

import { all, env, mediaUrl, useDatabase } from "@/lib/db";
import { deletePhoto, savePhoto } from "../actions";
import { FormGuard } from "../FormGuard";
import { Item, SortableRows } from "../List";
import { FormModal } from "../Modal";
import { MediaField } from "../MediaField";
import { Actions, DeleteButton, Field, PageHead, SaveButton, adminStyles as s } from "../ui";

type Row = { id: string; src: string; alt: string; position: number };

export default function PhotosPage() {
  useDatabase();
  const [rows, e] = [
    all<Row>("SELECT * FROM photos ORDER BY position"),
    env(),
  ] as const;
  const base = e.MEDIA_BASE_URL || undefined;

  const form = (p?: Row) => (
    <form action={savePhoto}>
      {p && <input type="hidden" name="id" value={p.id} />}
      <MediaField label="Photo" name="src" defaultValue={p?.src} max={960} />
      <div style={{ height: 14 }} />
      <Field label="Description" name="alt" defaultValue={p?.alt}
             hint="For screen readers, optional" />
      <Actions>
        <FormGuard requireOneOf={["src"]} message="Add the photo first." />
        <SaveButton label={p ? "Save" : "Add photo"} />
        {p && <DeleteButton action={deletePhoto} id={p.id} />}
      </Actions>
    </form>
  );

  return (
    <>
      <PageHead title="Photos"
        note="The sliding photo row at the foot of the home sidebar, and the gallery on the About page.">
        <FormModal label="Add photo" title="Add a photo" done="Photo added">
          {form()}
        </FormModal>
      </PageHead>
      {rows.length === 0 ? <p className={s.empty}>No photos yet.</p> : (
        <SortableRows table="photos" ids={rows.map((r) => r.id)} label="photos">
          {rows.map((p, i) => (
            <Item key={p.id} table="photos" id={p.id}
                  title={p.alt || `Photo ${i + 1}`} thumb={mediaUrl(p.src, base)}>
              {form(p)}
            </Item>
          ))}
        </SortableRows>
      )}
    </>
  );
}
