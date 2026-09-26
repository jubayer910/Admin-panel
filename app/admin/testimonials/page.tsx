"use client";

import { all, env, mediaUrl, useDatabase } from "@/lib/db";
import { deleteTestimonial, saveTestimonial } from "../actions";
import { Item, SortableRows } from "../List";
import { FormModal } from "../Modal";
import { MediaField } from "../MediaField";
import { Actions, DeleteButton, Field, PageHead, SaveButton, TextArea, adminStyles as s } from "../ui";

type Row = { id: string; quote: string; name: string; role: string; avatar: string | null; position: number };

export default function TestimonialsPage() {
  useDatabase();
  const [rows, e] = [
    all<Row>("SELECT * FROM testimonials ORDER BY position"),
    env(),
  ] as const;
  const base = e.MEDIA_BASE_URL || undefined;

  const form = (t?: Row) => (
    <form action={saveTestimonial}>
      {t && <input type="hidden" name="id" value={t.id} />}
      <TextArea label="What they said" name="quote" defaultValue={t?.quote} rows={4} />
      <div style={{ height: 14 }} />
      <div className={s.grid2}>
        <Field label="Name" name="name" defaultValue={t?.name} required />
        <Field label="Role" name="role" defaultValue={t?.role}
               placeholder="CEO, Company" />
      </div>
      <div style={{ height: 14 }} />
      <MediaField label="Photo" name="avatar" defaultValue={t?.avatar} shape="square" max={256} />
      <Actions>
        <SaveButton label={t ? "Save" : "Add testimonial"} />
        {t && <DeleteButton action={deleteTestimonial} id={t.id} />}
      </Actions>
    </form>
  );

  return (
    <>
      <PageHead title="Testimonials" note="Client recommendations, two per row on the site.">
        <FormModal label="Add testimonial" title="Add a testimonial" done="Testimonial added">
          {form()}
        </FormModal>
      </PageHead>
      {rows.length === 0 ? <p className={s.empty}>No testimonials yet.</p> : (
        <SortableRows table="testimonials" ids={rows.map((r) => r.id)} label="testimonials">
          {rows.map((t) => (
            <Item key={t.id} table="testimonials" id={t.id} title={t.name}
                  meta={t.role} thumb={mediaUrl(t.avatar, base)}>
              {form(t)}
            </Item>
          ))}
        </SortableRows>
      )}
    </>
  );
}
